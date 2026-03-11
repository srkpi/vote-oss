export interface VoteRecord {
  electionId: string;
  choiceId: string;
  choiceLabel: string;
  ballotHash: string;
  votedAt: string;
}

export interface VoteToken {
  token: string;
  signature: string;
}
