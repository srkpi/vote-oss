import type { CampaignState, ElectionKind, RestrictionType } from '@prisma/client';

export type { CampaignState, ElectionKind };

export interface ElectionCampaignRestriction {
  type: RestrictionType;
  value: string;
}

export type CampaignBoundaryEditability = 'locked' | 'extend_only' | 'editable';

/**
 * Per-field editability of a campaign's phase-boundary timestamps, derived
 * purely from the current time relative to each boundary:
 *  - 'locked': that boundary has already passed — immutable.
 *  - 'extend_only': the stage ending at this boundary is currently under
 *    way — the boundary may only move later (extend), never earlier.
 *  - 'editable': the stage ending at this boundary hasn't started yet —
 *    free to move either direction (still subject to the usual ordering and
 *    duration rules on PATCH).
 * `signaturesOpensAt`/`signaturesClosesAt` are `null` for campaigns that
 * don't use signature collection.
 */
export interface CampaignStageEditability {
  announcedAt: CampaignBoundaryEditability;
  registrationClosesAt: CampaignBoundaryEditability;
  signaturesOpensAt: CampaignBoundaryEditability | null;
  signaturesClosesAt: CampaignBoundaryEditability | null;
  votingOpensAt: CampaignBoundaryEditability;
  votingClosesAt: CampaignBoundaryEditability;
}

export interface ElectionCampaign {
  id: string;
  groupId: string;
  groupName: string;

  positionTitle: string;
  electionKind: ElectionKind;
  state: CampaignState;

  announcedAt: string;
  registrationClosesAt: string;
  signaturesOpensAt: string | null;
  signaturesClosesAt: string | null;

  signatureCollection: boolean;
  signatureQuorum: number | null;

  teamSize: number;
  requiresCampaignProgram: boolean;

  votingOpensAt: string;
  votingClosesAt: string;

  restrictions: ElectionCampaignRestriction[];

  registrationFormId: string | null;
  finalElectionId: string | null;

  createdBy: string;
  createdByFullName: string;
  createdAt: string;

  deletedAt: string | null;

  /** Which phase-boundary timestamps may be changed via PATCH right now. */
  stageEditability: CampaignStageEditability;
}

export interface CampaignSignatureElectionSummary {
  electionId: string;
  registrationId: string;
  candidateUserId: string;
  candidateFullName: string;
  opensAt: string;
  closesAt: string;
  ballotCount: number;
  quorum: number;
  quorumReached: boolean;
  status: 'upcoming' | 'open' | 'closed';
}

export interface CampaignFinalElectionChoice {
  candidateRegistrationId: string | null;
  candidateFullName: string;
  position: number;
  voteCount: number | null;
}

export interface CampaignFinalElectionSummary {
  electionId: string;
  status: 'upcoming' | 'open' | 'closed';
  opensAt: string;
  closesAt: string;
  ballotCount: number;
  choices: CampaignFinalElectionChoice[];
}

export interface CreateElectionCampaignRequest {
  positionTitle: string;
  electionKind: ElectionKind;
  announcedAt: string;
  registrationClosesAt: string;
  signatureCollection: boolean;
  signaturesOpensAt?: string | null;
  signaturesClosesAt?: string | null;
  signatureQuorum?: number | null;
  teamSize?: number;
  requiresCampaignProgram?: boolean;
  votingOpensAt: string;
  votingClosesAt: string;
  restrictions?: ElectionCampaignRestriction[];
}

/**
 * PATCH /api/campaigns/{id} body. Only the phase-boundary timestamps can be
 * edited post-creation — title, election kind, team size, restrictions etc.
 * stay fixed. Replace-all semantics: always send every field, including the
 * ones you're not changing (echo back the current value for those). Which
 * fields actually accept a new value depends on the campaign's current
 * `stageEditability` — see that type's docs.
 */
export interface UpdateElectionCampaignDatesRequest {
  announcedAt: string;
  registrationClosesAt: string;
  signaturesOpensAt?: string | null;
  signaturesClosesAt?: string | null;
  votingOpensAt: string;
  votingClosesAt: string;
}
