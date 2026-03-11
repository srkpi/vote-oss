export interface Ballot {
  id: string;
  encrypted_ballot: string;
  created_at: string;
  signature: string;
  previous_hash: string | null;
  current_hash: string;
}

export interface BallotsResponse {
  election: { id: string; title: string };
  ballots: Ballot[];
  total: number;
}

export interface DecryptionResult {
  choiceId: string | null;
  choiceLabel: string | null;
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

export interface BallotResponse {
  ok: boolean;
  ballotHash: string;
}
