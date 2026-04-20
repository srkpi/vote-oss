import type {
  ActivityPoint,
  AnalyticsTimePoint,
  ChartGranularity,
  SharePoint,
} from '@/types/analytics-charts';
import type { Ballot, BallotsElection, DecryptedMap } from '@/types/ballot';
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

/**
 * Determines the best time bucket size based solely on the election's
 * *effective* duration (open → min(close, now)).
 */
function determineGranularity(electionStartMs: number, effectiveEndMs: number): ChartGranularity {
  const durationH = Math.max(0, effectiveEndMs - electionStartMs) / 3_600_000;
  if (durationH < 3) return 'minute';
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

/**
 * Formats a single x-axis tick.
 *
 * `spanH` is the election's effective duration in hours. For 'minute'
 * granularity it is used to decide whether to prepend the day+month so that
 * ticks like "14:04" become "19 квіт. 14:04" when the election spans more
 * than one calendar day — eliminating ambiguity between timestamps on
 * different days.
 */
export function formatXTick(ms: number, granularity: ChartGranularity, spanH = 0): string {
  const d = new Date(ms);
  switch (granularity) {
    case 'minute':
      if (spanH >= 20) {
        return d.toLocaleString('uk-UA', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
      }

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
  election: BallotsElection,
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
    peakTiedCount: 0,
    isElectionClosed: false,
    velocityRatio: null,
    medianTimePercentile: null,
    frontrunnerChanges: null,
    normalizedEntropy: null,
    enc: null,
    gini: null,
    leadingMargin: null,
    voteCounts: {},
  };

  const now = Date.now();
  const electionStartMs = new Date(election.opensAt).getTime();
  const electionEndMs = new Date(election.closesAt).getTime();
  const isElectionClosed = now >= electionEndMs;

  // For ongoing elections never use the future close time as the denominator
  // it makes rate-based metrics nonsensical. Use elapsed time only.
  const effectiveEndMs = Math.min(electionEndMs, now);
  const effectiveDurationMs = Math.max(0, effectiveEndMs - electionStartMs);

  // spanH is passed to formatXTick so minute-level labels can include a date
  // when the election runs longer than a single day.
  const spanH = effectiveDurationMs / 3_600_000;

  if (ballots.length === 0) {
    return {
      sortedBallots: [],
      granularity: 'hour',
      timeSeries: [],
      activityData: [],
      shareEvolution: [],
      metrics: { ...emptyMetrics, isElectionClosed },
    };
  }

  const sortedBallots = [...ballots].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  // Granularity is now driven entirely by the election's effective duration,
  // not by ballot count or ballot spread. This prevents a multi-day election
  // with few votes from falling back to minute-level buckets.
  const granularity = determineGranularity(electionStartMs, effectiveEndMs);

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
      label: formatXTick(ms, granularity, spanH),
      total: cumulativeTotal,
    };
    choices.forEach((c) => {
      point[c.id] = cumulative[c.id]!;
    });
    return point;
  });

  // Activity buckets ──────────────────────────────────────────────────────────
  const activityBuckets = new Map<number, number>();

  // 1. Pre-fill the map with zeros for the entire duration.
  // This ensures the chart line hits 0 during periods of inactivity.
  let currentBucketMs = bucketMs(electionStartMs, granularity);
  const endLimitMs = bucketMs(effectiveEndMs, granularity);

  while (currentBucketMs <= endLimitMs) {
    activityBuckets.set(currentBucketMs, 0);

    // Advance to the next bucket based on granularity
    const d = new Date(currentBucketMs);
    switch (granularity) {
      case 'minute':
        d.setMinutes(d.getMinutes() + 1);
        break;
      case 'hour':
        d.setHours(d.getHours() + 1);
        break;
      case '6hour':
        d.setHours(d.getHours() + 6);
        break;
      case 'day':
        d.setDate(d.getDate() + 1);
        break;
    }
    currentBucketMs = d.getTime();
  }

  // 2. Populate the counts from actual ballots.
  sortedBallots.forEach((ballot) => {
    const ms = new Date(ballot.createdAt).getTime();
    const bucket = bucketMs(ms, granularity);

    // Safety: only increment if the bucket exists in our pre-filled range
    if (activityBuckets.has(bucket)) {
      activityBuckets.set(bucket, (activityBuckets.get(bucket) ?? 0) + 1);
    }
  });

  const activityData: ActivityPoint[] = [...activityBuckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bucket, count]) => ({
      ms: bucket,
      label: formatXTick(bucket, granularity, spanH),
      count,
    }));

  // Share evolution
  const shareEvolution: SharePoint[] = timeSeries.map((point) => {
    const total = point.total as number;
    const sp: SharePoint = { ms: point.ms as number, label: point.label as string };
    choices.forEach((c) => {
      sp[c.id] = total > 0 ? Math.round(((point[c.id] as number) / total) * 1000) / 10 : 0;
    });
    return sp;
  });

  // ── Timing metrics ──────────────────────────────────────────────────────────
  const totalBallots = sortedBallots.length;

  // Peak activity
  // Find the maximum bucket count and collect *all* buckets that share it.
  // When multiple buckets tie (e.g. every per-minute bucket has exactly 1 vote)
  // there is no meaningful "peak label" — we expose null so metric builders can
  // produce accurate prose rather than showing an arbitrary timestamp.
  const maxCount = activityData.length > 0 ? Math.max(...activityData.map((d) => d.count)) : 0;
  const peakBuckets = maxCount > 0 ? activityData.filter((d) => d.count === maxCount) : [];
  const peakTiedCount = peakBuckets.length;
  const peakHourConcentration = totalBallots > 0 ? (maxCount / totalBallots) * 100 : null;
  // Only expose a named label when there is a single, genuinely dominant period.
  const peakHourLabel = peakTiedCount === 1 ? (peakBuckets[0]?.label ?? null) : null;

  // Velocity ratio ─────────────────────────────────────────────────────────────
  // Compares the number of votes in the second half of the elapsed time interval
  // to the number of votes in the first half.
  let velocityRatio: number | null = null;

  if (totalBallots >= 4 && effectiveDurationMs > 0) {
    const midTime = electionStartMs + effectiveDurationMs / 2;

    let firstHalfCount = 0;
    let secondHalfCount = 0;

    for (const ballot of sortedBallots) {
      const t = new Date(ballot.createdAt).getTime();

      // Safety check: Ignore anomalies outside the valid timeline
      if (t < electionStartMs || t > effectiveEndMs) continue;

      if (t <= midTime) {
        firstHalfCount++;
      } else {
        secondHalfCount++;
      }
    }

    if (firstHalfCount > 0) {
      // Direct ratio of counts (since durations of both halves are identical,
      // the ratio of their counts is exactly equal to the ratio of their rates).
      velocityRatio = secondHalfCount / firstHalfCount;
    } else if (secondHalfCount > 0) {
      // Pathological case: 0 votes in first half, all votes in second half.
      // This is a massive late surge.
      velocityRatio = secondHalfCount;
    }
  }

  // Median time percentile ────────────────────────────────────────────────────
  // Position of the median ballot within elapsed election time [0, 100].
  // Using effectiveDurationMs instead of the full scheduled duration means an
  // election open for 48 h with all votes in the first hour gives ~40% (of the
  // 2.5 h elapsed so far), not 2% (of 48 h total).
  let medianTimePercentile: number | null = null;
  if (totalBallots >= 2 && effectiveDurationMs > 0) {
    const tMedian = new Date(sortedBallots[Math.floor(totalBallots / 2)]!.createdAt).getTime();
    const raw = ((tMedian - electionStartMs) / effectiveDurationMs) * 100;
    // Clamp to [0, 100] to absorb floating-point overshoot or clock skew.
    medianTimePercentile = Math.min(100, Math.max(0, raw));
  }

  // ── Decryption-dependent metrics ────────────────────────────────────────────
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
      let currentLeaderId: string | null = null;
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

        // 1. Find the highest vote count at this exact moment
        const maxVotes = Math.max(...choices.map((c) => cur[c.id]!));

        // 2. Check if the incumbent leader survived (incumbency advantage during a tie)
        if (currentLeaderId !== null && cur[currentLeaderId] === maxVotes) {
          // The incumbent is still tied for first, so they don't lose the lead.
          return;
        }

        // 3. The incumbent was strictly beaten. Find the new leader.
        // (If multiple choices tied for the new lead, simply pick the first one)
        const newLeader = choices.find((c) => cur[c.id] === maxVotes)!;

        // 4. Register the change (ignoring the very first ballot which just sets the baseline)
        if (currentLeaderId !== null && newLeader.id !== currentLeaderId) {
          changes++;
        }

        currentLeaderId = newLeader.id;
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
      peakTiedCount,
      isElectionClosed,
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
