import type { BallotVoterIdentity } from '@/lib/crypto';

export interface VoteRecord {
  electionId: string;
  choiceIds: string[];
  choiceLabels: string[];
  ballotHash: string;
  votedAt: string;
}

export interface VoteToken {
  token: string;
  signature: string;
  /**
   * Populated only for non-anonymous elections.  The client must embed this
   * identity into the v2 ballot envelope so that voter attribution can be
   * cryptographically verified by the server and later revealed when the
   * election closes and the private key is published.
   */
  voterIdentity?: BallotVoterIdentity;
}
