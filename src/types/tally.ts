export interface TallyResult {
  choiceId: number;
  choice: string;
  position: number;
  votes: number;
}

export interface TallyResponse {
  electionId: number;
  title: string;
  closedAt: string;
  privateKey: string;
  results: TallyResult[];
  totalBallots: number;
}
