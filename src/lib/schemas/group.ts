import { z } from 'zod';

export const groupCreateBodySchema = z.object({ name: z.string().optional() });
export const groupUpdateBodySchema = groupCreateBodySchema.extend({
  type: z.enum(['VKSU', 'OTHER']).optional(),
  requisites: z
    .object({
      fullName: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      contact: z.string().nullable().optional(),
    })
    .optional(),
});
export const groupInviteBodySchema = z.object({
  label: z.string().optional(),
  maxUsage: z.int().optional(),
  expiresAt: z.string().optional(),
});
export const tokenBodySchema = z.object({ token: z.string().optional() });
export const tokenRedemptionSchema = tokenBodySchema.extend({
  token: z.string().trim().min(1, 'Вставте токен запрошення'),
});
export const groupTransferBodySchema = z.object({ newOwnerId: z.string().optional() });
export const groupMemberRoleBodySchema = z.object({ role: z.string().nullable().optional() });
export const adminInviteBodySchema = z.object({
  maxUsage: z.int().optional(),
  manageAdmins: z.boolean().optional(),
  manageGroups: z.boolean().optional(),
  managePetitions: z.boolean().optional(),
  manageFaq: z.boolean().optional(),
  restrictedToFaculty: z.boolean().optional(),
  validDue: z.string().optional(),
});
