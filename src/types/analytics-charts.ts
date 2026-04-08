export interface LegendEntry {
  color: string;
  label: string;
}

export interface ChartExportSize {
  width: number;
  height: number;
}

export type ChartGranularity = 'minute' | 'hour' | '6hour' | 'day';

export interface AnalyticsTimePoint {
  ms: number;
  label: string;
  total: number;
  [choiceId: string]: number | string;
}

export interface ActivityPoint {
  ms: number;
  label: string;
  count: number;
}

export interface SharePoint {
  ms: number;
  label: string;
  [choiceId: string]: number | string;
}
