import type { ElectionChoice, ElectionStatus } from '@/types/election';

export interface Ballot {
  id: string;
  encryptedBallot: string;
  createdAt: string;
  signature: string;
  previousHash: string | null;
  currentHash: string;
}

export interface BallotsElection {
  id: string;
  title: string;
  opensAt: string;
  closesAt: string;
  status: ElectionStatus;
  ballotCount: number;
  choices: ElectionChoice[];
  privateKey?: string;
  deletedAt: string | null;
  shuffleChoices: boolean;
  publicViewing: boolean;
  anonymous: boolean;
  minChoices: number;
  maxChoices: number;
}

export interface BallotsResponse {
  election: BallotsElection;
  ballots: Ballot[];
  total: number;
}

export interface DecryptionResult {
  choiceIds: string[] | null;
  choiceLabels: string[] | null;
  valid: boolean;
  hashValid: boolean;
  /**
   * Populated after decrypting a v2 (identified) ballot in a non-anonymous
   * election.  `null` for anonymous ballots or when decryption failed.
   */
  voter: { userId: string; fullName: string } | null;
}

export type DecryptedMap = Map<string, DecryptionResult>;

export interface BallotSubmission {
  token: string;
  signature: string;
  encryptedBallot: string;
  nullifier: string;
}

export interface PetitionSignatoriesResponse {
  petition: {
    id: string;
    privateKey: string;
  };
  ballots: Ballot[];
}
