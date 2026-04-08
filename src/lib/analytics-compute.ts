import type {
  ActivityPoint,
  AnalyticsTimePoint,
  ChartGranularity,
  SharePoint,
} from '@/types/analytics-charts';
import type { Ballot, DecryptedMap } from '@/types/ballot';
import type { ElectionChoice } from '@/types/election';
import type { AnalyticsMetrics } from '@/types/metrics';

export interface AnalyticsResult {
  sortedBallots: Ballot[];
  granularity: ChartGranularity;
  timeSeries: AnalyticsTimePoint[];
  activityData: ActivityPoint[];
  shareEvolution: SharePoint[];
  metrics: AnalyticsMetrics;
}

export const CHART_COLORS = [
  '#1c396e',
  '#f07d00',
  '#008acf',
  '#7f0d38',
  '#10b981',
  '#8b5cf6',
  '#f43f5e',
  '#f59e0b',
  '#14b8a6',
  '#6366f1',
  '#06b6d4',
  '#ec4899',
  '#0d5690',
  '#84cc16',
  '#a855f7',
  '#0ea5e9',
] as const;

function determineGranularity(firstMs: number, lastMs: number, count: number): ChartGranularity {
  const durationH = (lastMs - firstMs) / 3_600_000;
  if (durationH < 3 || count < 20) return 'minute';
  if (durationH < 72) return 'hour';
  if (durationH < 336) return '6hour';
  return 'day';
}

function bucketMs(ms: number, granularity: ChartGranularity): number {
  const d = new Date(ms);
  switch (granularity) {
    case 'minute':
      d.setSeconds(0, 0);
      break;
    case 'hour':
      d.setMinutes(0, 0, 0);
      break;
    case '6hour': {
      const h = Math.floor(d.getHours() / 6) * 6;
      d.setHours(h, 0, 0, 0);
      break;
    }
    case 'day':
      d.setHours(0, 0, 0, 0);
      break;
  }
  return d.getTime();
}

export function formatXTick(ms: number, granularity: ChartGranularity): string {
  const d = new Date(ms);
  switch (granularity) {
    case 'minute':
      return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    case 'hour':
      return d.toLocaleString('uk-UA', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    case '6hour':
      return d.toLocaleString('uk-UA', { day: '2-digit', month: 'short', hour: '2-digit' }) + ':00';
    case 'day':
      return d.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short' });
  }
}

export const GRANULARITY_LABEL: Record<ChartGranularity, string> = {
  minute: 'по хвилинах',
  hour: 'по годинах',
  '6hour': 'по 6 год.',
  day: 'по днях',
};

export function computeAnalytics(
  ballots: Ballot[],
  decryptedMap: DecryptedMap,
  choices: ElectionChoice[],
  decryptionDone: boolean,
): AnalyticsResult {
  const emptyMetrics: AnalyticsMetrics = {
    totalBallots: 0,
    maxCount: 0,
    peakHourConcentration: null,
    peakHourLabel: null,
    velocityRatio: null,
    medianTimePercentile: null,
    frontrunnerChanges: null,
    normalizedEntropy: null,
    enc: null,
    gini: null,
    leadingMargin: null,
    voteCounts: {},
  };

  if (ballots.length === 0) {
    return {
      sortedBallots: [],
      granularity: 'hour',
      timeSeries: [],
      activityData: [],
      shareEvolution: [],
      metrics: emptyMetrics,
    };
  }

  const sortedBallots = [...ballots].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const firstMs = new Date(sortedBallots[0]!.createdAt).getTime();
  const lastMs = new Date(sortedBallots[sortedBallots.length - 1]!.createdAt).getTime();
  const totalDurationMs = lastMs - firstMs;
  const granularity = determineGranularity(firstMs, lastMs, ballots.length);

  // Vote counts per choice
  const voteCounts: Record<string, number> = {};
  choices.forEach((c) => {
    voteCounts[c.id] = 0;
  });

  if (decryptionDone) {
    sortedBallots.forEach((ballot) => {
      const dec = decryptedMap.get(ballot.id);
      if (dec?.valid && dec.choiceIds) {
        dec.choiceIds.forEach((id) => {
          if (voteCounts[id] !== undefined) voteCounts[id]++;
        });
      }
    });
  }

  // Cumulative time series
  const cumulative: Record<string, number> = {};
  choices.forEach((c) => {
    cumulative[c.id] = 0;
  });
  let cumulativeTotal = 0;

  const timeSeries: AnalyticsTimePoint[] = sortedBallots.map((ballot) => {
    const dec = decryptedMap.get(ballot.id);
    if (decryptionDone && dec?.valid && dec.choiceIds) {
      dec.choiceIds.forEach((id) => {
        if (cumulative[id] !== undefined) cumulative[id]++;
      });
    }
    cumulativeTotal++;
    const ms = new Date(ballot.createdAt).getTime();
    const point: AnalyticsTimePoint = {
      ms,
      label: formatXTick(ms, granularity),
      total: cumulativeTotal,
    };
    choices.forEach((c) => {
      point[c.id] = cumulative[c.id]!;
    });
    return point;
  });

  // Activity buckets
  const activityBuckets = new Map<number, number>();
  sortedBallots.forEach((ballot) => {
    const ms = new Date(ballot.createdAt).getTime();
    const bucket = bucketMs(ms, granularity);
    activityBuckets.set(bucket, (activityBuckets.get(bucket) ?? 0) + 1);
  });

  const activityData: ActivityPoint[] = [...activityBuckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bucket, count]) => ({ ms: bucket, label: formatXTick(bucket, granularity), count }));

  // Share evolution
  const shareEvolution: SharePoint[] = timeSeries.map((point) => {
    const total = point.total as number;
    const sp: SharePoint = { ms: point.ms as number, label: point.label as string };
    choices.forEach((c) => {
      sp[c.id] = total > 0 ? Math.round(((point[c.id] as number) / total) * 1000) / 10 : 0;
    });
    return sp;
  });

  // ── Timing metrics ──
  const totalBallots = sortedBallots.length;
  const maxCount = Math.max(...activityData.map((d) => d.count), 0);
  const peakBucket = activityData.find((d) => d.count === maxCount);
  const peakHourConcentration = totalBallots > 0 ? (maxCount / totalBallots) * 100 : null;
  const peakHourLabel = peakBucket?.label ?? null;

  let velocityRatio: number | null = null;
  if (totalBallots >= 4) {
    const mid = Math.floor(totalBallots / 2);
    const tM = new Date(sortedBallots[mid]!.createdAt).getTime();
    const firstHalfDur = tM - firstMs;
    const secondHalfDur = lastMs - tM;
    const r1 = firstHalfDur > 0 ? mid / firstHalfDur : 0;
    const r2 = secondHalfDur > 0 ? (totalBallots - mid) / secondHalfDur : 0;
    if (r1 > 0) velocityRatio = r2 / r1;
  }

  let medianTimePercentile: number | null = null;
  if (totalBallots >= 2 && totalDurationMs > 0) {
    const tMedian = new Date(sortedBallots[Math.floor(totalBallots / 2)]!.createdAt).getTime();
    medianTimePercentile = ((tMedian - firstMs) / totalDurationMs) * 100;
  }

  // ── Decryption-dependent metrics ──
  let normalizedEntropy: number | null = null;
  let enc: number | null = null;
  let gini: number | null = null;
  let leadingMargin: number | null = null;
  let frontrunnerChanges: number | null = null;

  if (decryptionDone && choices.length >= 2) {
    const total = Object.values(voteCounts).reduce((a, b) => a + b, 0);
    if (total > 0) {
      // Shannon normalised entropy
      let H = 0;
      choices.forEach((c) => {
        const p = voteCounts[c.id]! / total;
        if (p > 0) H -= p * Math.log2(p);
      });
      normalizedEntropy = H / Math.log2(choices.length);

      // ENC (Laakso-Taagepera)
      let hhi = 0;
      choices.forEach((c) => {
        const s = voteCounts[c.id]! / total;
        hhi += s * s;
      });
      enc = hhi > 0 ? 1 / hhi : choices.length;

      // Gini
      const sv = [...Object.values(voteCounts)].sort((a, b) => a - b);
      const n = sv.length;
      if (n > 1) {
        let gNum = 0;
        sv.forEach((v, i) => {
          gNum += (2 * (i + 1) - n - 1) * v;
        });
        // Multiply by (n / (n - 1)) to scale the max value to 1.0
        gini = Math.abs(gNum / (n * total)) * (n / (n - 1));
      }

      // Leading margin
      const byVotes = [...choices].sort((a, b) => voteCounts[b.id]! - voteCounts[a.id]!);
      leadingMargin =
        ((voteCounts[byVotes[0]!.id]! - (voteCounts[byVotes[1]?.id ?? ''] ?? 0)) / total) * 100;

      // Frontrunner changes
      let changes = 0;
      let prevLeader: string | null = null;
      const cur: Record<string, number> = {};
      choices.forEach((c) => {
        cur[c.id] = 0;
      });
      sortedBallots.forEach((ballot) => {
        const dec = decryptedMap.get(ballot.id);
        if (dec?.valid && dec.choiceIds) {
          dec.choiceIds.forEach((id) => {
            if (cur[id] !== undefined) cur[id]++;
          });
        }
        const leader = choices.reduce(
          (best, c) => (cur[c.id]! > cur[best.id]! ? c : best),
          choices[0]!,
        );
        if (prevLeader !== null && leader.id !== prevLeader) changes++;
        prevLeader = leader.id;
      });
      frontrunnerChanges = changes;
    }
  }

  return {
    sortedBallots,
    granularity,
    timeSeries,
    activityData,
    shareEvolution,
    metrics: {
      totalBallots,
      maxCount,
      peakHourConcentration,
      peakHourLabel,
      velocityRatio,
      medianTimePercentile,
      frontrunnerChanges,
      normalizedEntropy,
      enc,
      gini,
      leadingMargin,
      voteCounts,
    },
  };
}
