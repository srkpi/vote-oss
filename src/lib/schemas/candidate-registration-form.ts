import { z } from 'zod';

import {
  validatePhoneNumber,
  validateTelegramTag,
  validateCampaignProgramUrl,
  type ValidationResult,
} from '@/lib/registration-validators';
const validatedText = (validate: (value: string) => ValidationResult<string>, optional: boolean) =>
  z.string().transform((raw, ctx) => {
    if (optional && !raw.trim()) {
      return '';
    }
    const result = validate(raw);
    if (!result.ok) {
      ctx.addIssue({ code: 'custom', message: result.error });
      return z.NEVER;
    }
    return result.value;
  });
export function createCandidateRegistrationSchemas(requiresProgram: boolean) {
  const fields = {
    phoneNumber: validatedText(validatePhoneNumber, true),
    telegramTag: validatedText(validateTelegramTag, true),
    campaignProgramUrl: requiresProgram
      ? validatedText(validateCampaignProgramUrl, true)
      : z.string().transform(() => ''),
    confirmedNoOverlap: z.boolean(),
    confirmedDataAccurate: z.boolean(),
  };
  const draft = z.object(fields);
  const submission = z.object({
    ...fields,
    phoneNumber: validatedText(validatePhoneNumber, false),
    campaignProgramUrl: requiresProgram
      ? validatedText(validateCampaignProgramUrl, false)
      : fields.campaignProgramUrl,
    confirmedNoOverlap: z.boolean().refine(Boolean, 'Підтвердьте відсутність сумісництва'),
    confirmedDataAccurate: z.boolean().refine(Boolean, 'Підтвердьте достовірність даних'),
  });
  return { draft, submission };
}
export type CandidateRegistrationFormValues = z.input<
  ReturnType<typeof createCandidateRegistrationSchemas>['draft']
>;
