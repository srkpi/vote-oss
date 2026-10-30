import { z } from 'zod';

import {
  REGISTRATION_FORM_TITLE_MAX_LENGTH,
  REGISTRATION_FORM_DESCRIPTION_MAX_LENGTH,
  REGISTRATION_FORM_MAX_TEAM_SIZE,
} from '@/lib/constants';
export type RegistrationDialogTarget = { opensAt: string; closesAt: string };
export function getRegistrationDialogPhase(target: RegistrationDialogTarget | null, now: number) {
  if (!target) {
    return 'not_started';
  }
  if (now >= Date.parse(target.closesAt)) {
    return 'closed';
  }
  return now >= Date.parse(target.opensAt) ? 'open' : 'not_started';
}
const fields = z.object({
  title: z.string().trim().min(1, 'Вкажіть заголовок').max(REGISTRATION_FORM_TITLE_MAX_LENGTH),
  description: z.string().trim().max(REGISTRATION_FORM_DESCRIPTION_MAX_LENGTH),
  requiresCampaignProgram: z.boolean(),
  teamSize: z.int().min(0).max(REGISTRATION_FORM_MAX_TEAM_SIZE),
  opensAt: z.date(),
  closesAt: z.date(),
  faculties: z.array(z.string()),
});
export function createRegistrationDialogSchema(
  target: RegistrationDialogTarget | null,
  now: () => number = Date.now,
) {
  return fields.superRefine((values, ctx) => {
    const time = now();
    const phase = getRegistrationDialogPhase(target, time);
    const issue = (field: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [field], message });
    if (phase === 'closed') {
      issue('root', 'Прийом заявок вже завершився');
      return;
    }
    if (values.closesAt <= values.opensAt) {
      issue('closesAt', 'Кінець прийому має бути після початку');
    }
    if (phase === 'not_started') {
      if (values.opensAt.getTime() <= time) {
        issue('opensAt', 'Початок прийому має бути після поточного часу');
      }
      if (values.closesAt.getTime() <= time) {
        issue('closesAt', 'Кінець прийому має бути після поточного часу');
      }
    } else if (target) {
      if (values.opensAt.getTime() !== Date.parse(target.opensAt)) {
        issue('opensAt', 'Прийом заявок уже розпочато — початок змінити неможливо');
      }
      if (values.closesAt.getTime() < Date.parse(target.closesAt)) {
        issue('closesAt', 'Прийом заявок уже розпочато — кінець можна лише продовжити');
      }
    }
  });
}
export type RegistrationDialogValues = z.infer<typeof fields>;
