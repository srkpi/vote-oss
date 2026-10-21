import { z } from 'zod';

export const kpiTicketResponseSchema = z.object({
  data: z
    .object({
      EMPLOYEE_ID: z.string().default(''),
      AUTH_METHOD: z.string().default(''),
      STUDENT_ID: z.string().default(''),
      TAX_ID: z.string().default(''),
      NAME: z.string().default(''),
      TRACE_ID: z.string().default(''),
      TIME_STAMP: z.string().default(''),
    })
    .optional(),
});

export const campusGroupsSchema = z.array(
  z.object({
    name: z.string().min(1),
    faculty: z.string().trim().min(1),
  }),
);
export const facultyGroupsSchema = z.record(z.string(), z.array(z.string()));

export const campusUserSchema = z.object({
  groupName: z.string().min(1),
  faculty: z.string().min(1),
  status: z.enum(['Studying', 'OnAcademicLeave', 'Dismissed']),
  studyForm: z.string().optional(),
  studyYear: z.number().optional(),
  speciality: z.string().optional(),
});

export const documentContentTypeSchema = z
  .string()
  .transform((value) => value.split(';')[0].trim().toLowerCase())
  .pipe(z.enum(['application/pdf', 'application/octet-stream']));
