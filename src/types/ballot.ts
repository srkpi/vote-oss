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
  status: ElectionStatus;
  ballotCount: number;
  choices: ElectionChoice[];
  privateKey?: string;
  deletedAt: string | null;
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
}

export type DecryptedMap = Map<string, DecryptionResult>;

export interface BallotSubmission {
  token: string;
  signature: string;
  encryptedBallot: string;
  nullifier: string;
}
