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
}
