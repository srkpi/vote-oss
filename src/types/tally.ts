export interface TallyResult {
  choiceId: string;
  choice: string;
  position: number;
  votes: number;
}

export interface TallyResponse {
  electionId: string;
  title: string;
  closedAt: string;
  privateKey: string;
  results: TallyResult[];
  totalBallots: number;
}
