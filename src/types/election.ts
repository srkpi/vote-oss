export type ElectionStatus = 'upcoming' | 'open' | 'closed';
export type RestrictionType =
  | 'FACULTY'
  | 'GROUP'
  | 'SPECIALITY'
  | 'STUDY_YEAR'
  | 'STUDY_FORM'
  | 'LEVEL_COURSE';

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

export interface ElectionCreator {
  fullName: string;
  faculty: string;
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

export interface Election {
  id: string;
  title: string;
  createdAt: string;
  opensAt: string;
  closesAt: string;
  status: ElectionStatus;
  restrictions: ElectionRestriction[];
  minChoices: number;
  maxChoices: number;
  creator: ElectionCreator;
  choices: ElectionChoice[];
  ballotCount: number;

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

/**
 * Shape stored in Redis.
 * - `canDelete` and `canRestore` are NOT cached because they depend on the
 *   requesting admin's identity; they are computed at serve time.
 * - `createdBy` stores the creator's userId for hierarchy checks.
 * - `deletedAt`/`deletedByUserId`/`deletedByName` support soft-delete.
 */
export interface CachedElection {
  id: string;
  title: string;
  createdAt: string;
  opensAt: string;
  closesAt: string;
  restrictions: ElectionRestriction[];
  minChoices: number;
  maxChoices: number;
  publicKey: string;
  privateKey: string;
  creator: ElectionCreator;
  choices: CachedElectionChoice[];
  ballotCount: number;
  createdBy: string;
  deletedAt: string | null;
  deletedByUserId: string | null;
  deletedByName: string | null;
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
  title: string;
  opensAt: string;
  closesAt: string;
  choices: string[];
  minChoices?: number;
  maxChoices?: number;
  restrictions?: CreateElectionRestriction[];
}

export interface CreateElectionResponse {
  id: string;
  title: string;
  opensAt: string;
  closesAt: string;
  minChoices: number;
  maxChoices: number;
  publicKey: string;
  choices: ElectionChoice[];
  restrictions: ElectionRestriction[];
}
