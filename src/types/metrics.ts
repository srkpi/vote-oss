import type { Ballot, DecryptedMap } from '@/types/ballot';
import type { ElectionChoice } from '@/types/election';

export interface AnalyticsMetrics {
  totalBallots: number;
  maxCount: number;
  peakHourConcentration: number | null;
  peakHourLabel: string | null;
  peakTiedCount: number;
  isElectionClosed: boolean;
  velocityRatio: number | null; // null = fewer than 4 ballots
  medianTimePercentile: number | null; // null = fewer than 2 ballots
  frontrunnerChanges: number | null; // null = not decrypted
  normalizedEntropy: number | null; // null = not decrypted
  enc: number | null; // null = not decrypted
  gini: number | null; // null = not decrypted
  leadingMargin: number | null; // null = not decrypted
  voteCounts: Record<string, number>;
}

export interface MetricScaleConfig {
  min: number;
  max: number;
  current: number;
  gradientFrom: string;
  gradientTo: string;
  labels: [string, string];
}

export interface MetricCardConfig {
  id: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  interpretation: string;
  color: 'navy' | 'orange' | 'blue' | 'success' | 'warning' | 'error' | 'purple';
  description: string;
  insight: string;
  scale?: MetricScaleConfig;
}

export interface MetricContext {
  ballots: Ballot[];
  decryptedMap: DecryptedMap;
  decryptionDone: boolean;
  choices: ElectionChoice[];

  metrics: AnalyticsMetrics;

  totalBallots: number;
  choiceCount: number;
}

export type MetricBuilder = (ctx: MetricContext) => MetricCardConfig | null;
