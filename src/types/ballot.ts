export interface Ballot {
  id: string;
  encryptedBallot: string;
  createdAt: string;
  signature: string;
  previousHash: string | null;
  currentHash: string;
}

export interface BallotsResponse {
  election: { id: string; title: string };
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
