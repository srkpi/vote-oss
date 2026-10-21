import { z } from 'zod';

export function validationMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue.path.map(String).join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}

export const trimmedString = (maxLength: number) => z.string().trim().min(1).max(maxLength);

export const restrictionSchema = z.object({
  type: z.enum([
    'FACULTY',
    'GROUP',
    'SPECIALITY',
    'STUDY_YEAR',
    'STUDY_FORM',
    'LEVEL_COURSE',
    'BYPASS_REQUIRED',
    'GROUP_MEMBERSHIP',
  ]),
  value: z.string(),
});

// Keep the existing API contract: UUID version 4 with the RFC variant bits.
export const uuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
