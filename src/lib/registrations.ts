/**
 * Helpers for the candidate registration submissions API:
 *  - canonical Prisma `include` shape and DB → client transformer
 *  - submit-time payload assembly
 */

import type { Prisma } from '@prisma/client';

import { safeDecrypt } from '@/lib/elections-view';
import type { CandidateRegistration } from '@/types/candidate-registration';

export type RegistrationRow = Prisma.CandidateRegistrationGetPayload<true>;

export function shapeRegistration(reg: RegistrationRow): CandidateRegistration {
  return {
    id: reg.id,
    formId: reg.form_id,
    userId: reg.user_id,
    fullName: safeDecrypt(reg.full_name),
    phoneNumber: safeDecrypt(reg.phone_number),
    telegramTag: safeDecrypt(reg.telegram_tag),
    campaignProgramUrl: reg.campaign_program_url ? safeDecrypt(reg.campaign_program_url) : null,
    status: reg.status,
    submittedAt: reg.submitted_at?.toISOString() ?? null,
    reviewedByUserId: reg.reviewed_by_user_id ?? null,
    reviewedByFullName: reg.reviewed_by_full_name ? safeDecrypt(reg.reviewed_by_full_name) : null,
    reviewedAt: reg.reviewed_at?.toISOString() ?? null,
    rejectionReason: reg.rejection_reason ?? null,
    withdrawnAt: reg.withdrawn_at?.toISOString() ?? null,
    createdAt: reg.created_at.toISOString(),
    updatedAt: reg.updated_at.toISOString(),
  };
}
