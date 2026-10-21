import { z } from 'zod';

import {
  GROUP_REQUISITES_FULL_NAME_MAX_LENGTH,
  GROUP_REQUISITES_ADDRESS_MAX_LENGTH,
  GROUP_REQUISITES_EMAIL_MAX_LENGTH,
  GROUP_REQUISITES_CONTACT_MAX_LENGTH,
} from '@/lib/constants';
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Максимум ${max} символів`)
    .transform((value) => value || null);
export const groupRequisitesFormSchema = z.object({
  fullName: optionalText(GROUP_REQUISITES_FULL_NAME_MAX_LENGTH),
  address: optionalText(GROUP_REQUISITES_ADDRESS_MAX_LENGTH),
  email: z
    .string()
    .trim()
    .max(GROUP_REQUISITES_EMAIL_MAX_LENGTH)
    .refine((value) => !value || z.email().safeParse(value).success, 'Невірна електронна пошта')
    .transform((value) => value || null),
  contact: optionalText(GROUP_REQUISITES_CONTACT_MAX_LENGTH),
});
export type GroupRequisitesInput = z.input<typeof groupRequisitesFormSchema>;
export type GroupRequisitesOutput = z.output<typeof groupRequisitesFormSchema>;
