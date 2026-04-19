import type { Prisma } from '@prisma/client';

export type ElectionStatus = 'upcoming' | 'open' | 'closed';
export type RestrictionType =
  | 'FACULTY'
  | 'GROUP'
  | 'SPECIALITY'
  | 'STUDY_YEAR'
  | 'STUDY_FORM'
  | 'LEVEL_COURSE'
  | 'BYPASS_REQUIRED';

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

export interface Election {
  id: string;
  title: string;
  createdAt: string;
  opensAt: string;
  closesAt: string;
  status: ElectionStatus;
  restrictions: ElectionRestriction[];
  winningConditions: WinningConditions;
  shuffleChoices: boolean;
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
  title: string;
  opensAt: string;
  closesAt: string;
  choices: string[];
  minChoices?: number;
  maxChoices?: number;
  restrictions?: CreateElectionRestriction[];
  winningConditions?: Partial<WinningConditions>;
  shuffleChoices?: boolean;
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
  winningConditions: WinningConditions;
  shuffleChoices: boolean;
}
