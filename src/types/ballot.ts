export interface Ballot {
  id: number;
  encrypted_ballot: string;
  created_at: string;
  signature: string;
  previous_hash: string | null;
  current_hash: string;
}

export interface BallotsResponse {
  election: { id: number; title: string };
  ballots: Ballot[];
  total: number;
}

export interface DecryptionResult {
  choiceId: number | null;
  choiceLabel: string | null;
  valid: boolean;
  hashValid: boolean;
}

export type DecryptedMap = Map<number, DecryptionResult>;

export interface BallotSubmission {
  token: string;
  signature: string;
  encryptedBallot: string;
  nullifier: string;
}

export interface BallotResponse {
  ok: boolean;
  ballotHash: string;
}
