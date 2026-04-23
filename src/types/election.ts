import type { Prisma } from '@prisma/client';

export type ElectionStatus = 'upcoming' | 'open' | 'closed';
/**
 * Discriminates regular elections from petitions.  Most fields on the
 * Election interface are shared, but PETITION-type records are subject to
 * additional invariants (single "Підтримати" choice, non-anonymous, fixed
 * quorum, admin-approval workflow for non-admin creators).
 */
export type ElectionType = 'ELECTION' | 'PETITION';
export type RestrictionType =
  | 'FACULTY'
  | 'GROUP'
  | 'SPECIALITY'
  | 'STUDY_YEAR'
  | 'STUDY_FORM'
  | 'LEVEL_COURSE'
  | 'BYPASS_REQUIRED'
  | 'GROUP_MEMBERSHIP';

/**
 * Indicates whether the authenticated user can participate in an election.
 *
 * - `can_vote`     – election is open and the user is eligible and has not voted yet
 * - `voted`        – the user has already cast their ballot (token was issued)
 * - `cannot_vote`  – election is open but the user does not meet the restrictions
 *
 * This field is only populated for regular user responses from the elections
 * list endpoint.  Admin responses omit it.
 */
export type ElectionVoteStatus = 'can_vote' | 'voted' | 'cannot_vote';

export interface ElectionRestriction {
  type: RestrictionType;
  value: string;
}

export interface ElectionChoice {
  id: string;
  choice: string;
  position: number;

  /** Present only for closed elections */
  votes?: number;
  winner?: boolean;
}

export interface CachedElectionChoice extends ElectionChoice {
  voteCount: number | null;
}

/**
 * Reference to a user who authored an election or petition.  For petitions
 * this user may be a regular (non-admin) student, so `userId` is intentionally
 * not constrained to the Admin table.
 */
export interface ElectionAuthor {
  userId: string;
  fullName: string;
}

export interface ElectionDeleter {
  userId: string;
  fullName: string;
}

export interface TallyResult {
  choiceId: string;
  choice: string;
  position: number;
  votes: number;
  winner: boolean;
}

/**
 * All four conditions are ANDed together.  Only options satisfying every
 * enabled condition win.  Ties (multiple options satisfying all conditions
 * with the same highest vote count) are all marked as winners.
 *
 * - hasMostVotes       – option must have the maximum vote count
 * - reachesPercentage  – votes / totalBallots * 100 must be strictly > X
 * - reachesVotes       – option must have at least X votes
 * - quorum             – total ballots cast must be at least X; if not met,
 *                        no option wins regardless of other conditions
 */
export interface WinningConditions extends Prisma.InputJsonObject {
  hasMostVotes: boolean;
  reachesPercentage: number | null; // [0, 100)
  reachesVotes: number | null;
  quorum: number | null;
}

export interface WinningConditionsState {
  hasMostVotes: boolean;
  reachesPercentageEnabled: boolean;
  reachesPercentage: number;
  reachesVotesEnabled: boolean;
  reachesVotes: number;
  quorumEnabled: boolean;
  quorum: number;
}

export const DEFAULT_WINNING_CONDITIONS: WinningConditions = {
  hasMostVotes: true,
  reachesPercentage: null,
  reachesVotes: null,
  quorum: null,
};

export const DEFAULT_WINNING_CONDITIONS_SINGLE_CHOICE: WinningConditions = {
  hasMostVotes: false,
  reachesPercentage: null,
  reachesVotes: null,
  quorum: 1,
};

export interface ElectionRestrictedGroups {
  id: string;
  name: string;
}

export interface Election {
  id: string;
  type: ElectionType;
  title: string;
  description: string | null;
  createdAt: string;
  opensAt: string;
  closesAt: string;
  status: ElectionStatus;
  restrictions: ElectionRestriction[];
  winningConditions: WinningConditions;
  shuffleChoices: boolean;
  anonymous: boolean;
  minChoices: number;
  maxChoices: number;
  /** Decoupled from the Admin table so that regular users can create petitions. */
  createdBy: ElectionAuthor;
  /** Petition approval metadata.  `approved=true` for all non-petition elections. */
  approved: boolean;
  approvedBy: ElectionAuthor | null;
  approvedAt: string | null;
  choices: ElectionChoice[];
  publicViewing: boolean;
  ballotCount: number;
  restrictedGroups?: ElectionRestrictedGroups[];

  /**
   * Whether this user can vote / has voted / cannot vote.
   * Populated only in regular-user responses from the elections list endpoint.
   * Absent for election detail endpoint.
   */
  voteStatus?: ElectionVoteStatus;

  /** Only present for admin-authenticated responses */
  deletedAt?: string | null;
  deletedBy?: ElectionDeleter | null;
  canDelete?: boolean;
  canRestore?: boolean;
}

export interface ElectionDetail extends Election {
  publicKey: string;
  privateKey?: string;
  hasVoted?: boolean;
  bypassedTypes?: string[];
}

export interface CachedElection {
  id: string;
  type: ElectionType;
  title: string;
  description: string | null;
  createdAt: string;
  opensAt: string;
  closesAt: string;
  restrictions: ElectionRestriction[];
  minChoices: number;
  maxChoices: number;
  publicKey: string;
  privateKey: string;
  /** Decrypted at cache-populate time; safe to serve directly to clients. */
  createdByFullName: string;
  choices: CachedElectionChoice[];
  publicViewing: boolean;
  anonymous: boolean;
  ballotCount: number;
  createdBy: string;
  approved: boolean;
  approvedById: string | null;
  /** Decrypted at cache-populate time; safe to serve directly to clients. */
  approvedByFullName: string | null;
  approvedAt: string | null;
  deletedAt: string | null;
  deletedByUserId: string | null;
  deletedByName: string | null;
  winningConditions: WinningConditions;
  shuffleChoices: boolean;
}

export interface ElectionFilters {
  status?: ElectionStatus | 'all';
  search?: string;
  faculty?: string;
}

export interface CreateElectionRestriction {
  type: RestrictionType;
  value: string;
}

export interface CreateElectionRequest {
  /** Defaults to ELECTION when omitted. Only admins with `manage_petitions` (or self-approved as creator) can set PETITION; for non-admin users, the server coerces this to PETITION regardless of payload. */
  type?: ElectionType;
  title: string;
  description?: string | null;
  /** Ignored for PETITION (server fills with PETITION_OPEN_MONTHS on approval). */
  opensAt?: string;
  closesAt?: string;
  /** Ignored for PETITION (server seeds single PETITION_SUPPORT_CHOICE_LABEL). */
  choices?: string[];
  minChoices?: number;
  maxChoices?: number;
  restrictions?: CreateElectionRestriction[];
  winningConditions?: Partial<WinningConditions>;
  shuffleChoices?: boolean;
  publicViewing?: boolean;
  /** Defaults to `true` (anonymous) when omitted. Forced to `false` for PETITION. */
  anonymous?: boolean;
}

export interface CreateElectionResponse {
  id: string;
  type: ElectionType;
  title: string;
  description: string | null;
  opensAt: string;
  closesAt: string;
  minChoices: number;
  maxChoices: number;
  publicKey: string;
  choices: ElectionChoice[];
  restrictions: ElectionRestriction[];
  winningConditions: WinningConditions;
  shuffleChoices: boolean;
  anonymous: boolean;
  approved: boolean;
  approvedAt: string | null;
}

// ---------------------------------------------------------------------------
// Elections list API response
// ---------------------------------------------------------------------------

/**
 * Metadata about the available filter options derived from the elections the
 * caller can see.  Sent alongside the elections array so the client does not
 * need an extra round-trip to populate filter dropdowns.
 */
export interface ElectionsFilterMeta {
  /** All faculty codes that appear in at least one visible election's FACULTY restrictions. */
  faculties: string[];
  /** All study-form values that appear in at least one visible election's STUDY_FORM restrictions. */
  studyForms: string[];
}

/**
 * Response shape for `GET /api/elections`.
 *
 * Changed from a bare `Election[]` to a structured envelope so we can include
 * pagination metadata and filter dropdown data without extra round-trips.
 *
 * **Backward-compat note for admin pages:** update callers from
 * `data ?? []` to `data?.elections ?? []`.
 */
export interface ElectionsListResponse {
  elections: Election[];
  /** Total number of elections matching the caller's visibility rules (before client-side filter). */
  total: number;
  /** Populated filter option data so the client can build dropdowns. */
  meta: ElectionsFilterMeta;
}
