import type { CandidateRegistrationStatus, RestrictionType } from '@prisma/client';

export type { CandidateRegistrationStatus };

export interface CandidateRegistrationFormRestriction {
  type: RestrictionType;
  value: string;
}

export interface CandidateRegistrationForm {
  id: string;
  groupId: string;
  groupName: string;
  title: string;
  description: string | null;
  requiresCampaignProgram: boolean;
  teamSize: number;
  opensAt: string;
  closesAt: string;
  restrictions: CandidateRegistrationFormRestriction[];
  createdBy: string;
  createdByFullName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCandidateRegistrationFormRequest {
  title: string;
  description?: string | null;
  requiresCampaignProgram?: boolean;
  teamSize?: number;
  opensAt: string;
  closesAt: string;
  restrictions?: CandidateRegistrationFormRestriction[];
}

export interface UpdateCandidateRegistrationFormRequest {
  title?: string;
  description?: string | null;
  requiresCampaignProgram?: boolean;
  teamSize?: number;
  opensAt?: string;
  closesAt?: string;
  restrictions?: CandidateRegistrationFormRestriction[];
}

// ── Candidate registration submissions ─────────────────────────────────────

export interface CandidateRegistration {
  id: string;
  formId: string;
  userId: string;
  fullName: string;
  phoneNumber: string;
  telegramTag: string;
  campaignProgramUrl: string | null;
  status: CandidateRegistrationStatus;
  submittedAt: string | null;
  reviewedByUserId: string | null;
  reviewedByFullName: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Form details shipped to the candidate, plus their existing registration if any. */
export interface CandidateRegistrationFormDetail extends CandidateRegistrationForm {
  myRegistration: CandidateRegistration | null;
  /** Whether the caller satisfies every restriction on the form. */
  eligible: boolean;
}

/** List item shape returned from `GET /api/registration-forms`. */
export interface CandidateRegistrationFormSummary extends CandidateRegistrationForm {
  /** Whether the caller satisfies every restriction on the form. */
  eligible: boolean;
  /** Status of the caller's existing registration on this form, if any. */
  myRegistrationStatus: CandidateRegistrationStatus | null;
}

/**
 * Form shape returned from `GET /api/groups/{id}/registration-forms` (admin /
 * ВКСУ view).  Includes per-form aggregate counts so the management UI can
 * surface workload at a glance.
 */
export interface CandidateRegistrationFormAdminSummary extends CandidateRegistrationForm {
  /** All registrations on this form except DRAFT (which are private to the candidate). */
  submittedCount: number;
  /** Submissions currently awaiting reviewer action (status = PENDING_REVIEW). */
  pendingReviewCount: number;
}

export interface UpsertCandidateRegistrationDraftRequest {
  phoneNumber?: string;
  telegramTag?: string;
  campaignProgramUrl?: string | null;
}

export interface RejectCandidateRegistrationRequest {
  reason: string;
}

// ── Team invites ───────────────────────────────────────────────────────────

/**
 * Per-slot view served to the candidate.  States:
 *  - empty               no token has ever been issued
 *  - pending             token outstanding, awaiting invitee response
 *  - rejected            invitee declined the invite
 *  - expired             token was revoked or its TTL is past
 *  - awaiting_candidate  invitee accepted; candidate must confirm or decline
 *  - declined            candidate decided not to keep the invitee
 *  - accepted            invitee accepted and candidate confirmed (terminal)
 *
 * In every non-`accepted` state the candidate may regenerate a fresh share
 * link, except in `awaiting_candidate` where a decision must be taken first.
 */
export type TeamSlotState =
  | 'empty'
  | 'pending'
  | 'rejected'
  | 'expired'
  | 'awaiting_candidate'
  | 'declined'
  | 'accepted';

export interface TeamSlot {
  slot: number;
  state: TeamSlotState;
  /** Always set for `accepted`; informative for `rejected`. */
  member: { userId: string; fullName: string } | null;
  /** Active token's expiry (only when `state === 'pending'`). */
  expiresAt: string | null;
  /** When the slot was last filled / decided. */
  resolvedAt: string | null;
}

export interface TeamInvitePreview {
  token: string;
  registrationId: string;
  slot: number;
  candidate: { userId: string; fullName: string };
  formId: string;
  formTitle: string;
  groupName: string;
  expiresAt: string;
  /** Already used? */
  used: boolean;
  response: 'ACCEPTED' | 'REJECTED' | null;
  /** Candidate's verdict on the invitee.  Only meaningful once response='ACCEPTED'. */
  candidateDecision: 'CONFIRMED' | 'DECLINED' | null;
  revoked: boolean;
}

export interface RegenerateTeamInviteResponse {
  slot: number;
  /** Plaintext token — returned only on creation; not stored anywhere else. */
  token: string;
  expiresAt: string;
}
