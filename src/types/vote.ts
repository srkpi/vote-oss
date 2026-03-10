export interface VoteRecord {
  electionId: number;
  choiceId: number;
  choiceLabel: string;
  ballotHash: string;
  votedAt: string;
}

export interface VoteToken {
  token: string;
  signature: string;
}
