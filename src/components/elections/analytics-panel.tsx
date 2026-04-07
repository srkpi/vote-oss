'use client';

import {
  Activity,
  BarChart2,
  Clock,
  Download,
  FileSpreadsheet,
  GitBranch,
  Info,
  Scale,
  Target,
  TrendingUp,
  Unlock,
  Zap,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/config/client';
import { cn, pluralize } from '@/lib/utils';
import type { Ballot, BallotsElection, DecryptedMap } from '@/types/ballot';
import type { ElectionChoice } from '@/types/election';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** Matches the color palette in result-chart.tsx for visual consistency */
const CHOICE_COLORS = [
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
];

const CSV_FIELDS: { key: string; label: string; requiresDecryption?: boolean }[] = [
  { key: 'index', label: 'Індекс бюлетеня' },
  { key: 'currentHash', label: 'Поточний хеш' },
  { key: 'previousHash', label: 'Попередній хеш' },
  { key: 'createdAt', label: 'Час голосування' },
  { key: 'signature', label: 'Підпис' },
  { key: 'encryptedBallot', label: 'Зашифрований бюлетень' },
  { key: 'decryptedChoiceIds', label: 'ID варіантів', requiresDecryption: true },
  { key: 'decryptedChoiceLabels', label: 'Вибір', requiresDecryption: true },
  { key: 'hashValid', label: 'Цілісність хешу', requiresDecryption: true },
  { key: 'ballotValid', label: 'Дійсність бюлетеня', requiresDecryption: true },
];

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface AnalyticsPanelProps {
  ballots: Ballot[];
  decryptedMap: DecryptedMap;
  decryptionDone: boolean;
  isDecrypting: boolean;
  onDecrypt: () => void;
  choices: ElectionChoice[];
  election: BallotsElection;
}

interface AnalyticsMetrics {
  // Decryption-independent
  totalBallots: number;
  maxCount: number;
  peakHourConcentration: number;
  peakHourLabel: string;
  velocityRatio: number;
  medianTimePercentile: number;
  frontrunnerChanges: number | null; // null when not decrypted
  // Decryption-dependent
  normalizedEntropy: number | null;
  enc: number | null;
  gini: number | null;
  leadingMargin: number | null;
  voteCounts: Record<string, number>;
}

type ChartGranularity = 'minute' | 'hour' | '6hour' | 'day';

// ─────────────────────────────────────────────────────────────
// Pure computation helpers
// ─────────────────────────────────────────────────────────────

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

function formatXTick(ms: number, granularity: ChartGranularity): string {
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

function computeAnalytics(
  ballots: Ballot[],
  decryptedMap: DecryptedMap,
  choices: ElectionChoice[],
  decryptionDone: boolean,
) {
  if (ballots.length === 0) {
    return {
      sortedBallots: [],
      granularity: 'hour' as ChartGranularity,
      timeSeries: [],
      activityData: [],
      shareEvolution: [],
      metrics: {
        totalBallots: 0,
        peakHourConcentration: 0,
        peakHourLabel: '—',
        velocityRatio: 1,
        medianTimePercentile: 50,
        frontrunnerChanges: null,
        normalizedEntropy: null,
        enc: null,
        gini: null,
        leadingMargin: null,
        voteCounts: {},
      } as AnalyticsMetrics,
    };
  }

  const sortedBallots = [...ballots].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const firstMs = new Date(sortedBallots[0]!.createdAt).getTime();
  const lastMs = new Date(sortedBallots[sortedBallots.length - 1]!.createdAt).getTime();
  const totalDurationMs = lastMs - firstMs;

  const granularity = determineGranularity(firstMs, lastMs, ballots.length);

  // ── Vote counts per choice ──────────────────────────────────
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

  // ── Cumulative time series ──────────────────────────────────
  const cumulative: Record<string, number> = {};
  choices.forEach((c) => {
    cumulative[c.id] = 0;
  });
  let cumulativeTotal = 0;

  const timeSeries = sortedBallots.map((ballot) => {
    const dec = decryptedMap.get(ballot.id);
    if (decryptionDone && dec?.valid && dec.choiceIds) {
      dec.choiceIds.forEach((id) => {
        if (cumulative[id] !== undefined) cumulative[id]++;
      });
    }
    cumulativeTotal++;
    const ms = new Date(ballot.createdAt).getTime();
    const point: Record<string, number | string> = {
      ms,
      label: formatXTick(ms, granularity),
      total: cumulativeTotal,
    };
    choices.forEach((c) => {
      point[c.id] = cumulative[c.id]!;
    });
    return point;
  });

  // ── Hourly activity (bar chart) ─────────────────────────────
  const activityBuckets = new Map<number, number>();
  sortedBallots.forEach((ballot) => {
    const ms = new Date(ballot.createdAt).getTime();
    const bucket = bucketMs(ms, granularity);
    activityBuckets.set(bucket, (activityBuckets.get(bucket) ?? 0) + 1);
  });
  const activityData = [...activityBuckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bucket, count]) => ({
      ms: bucket,
      label: formatXTick(bucket, granularity),
      count,
    }));

  // ── Vote share evolution ────────────────────────────────────
  const shareEvolution = timeSeries.map((point) => {
    const total = point.total as number;
    const sp: Record<string, number | string> = { ms: point.ms, label: point.label };
    choices.forEach((c) => {
      sp[c.id] = total > 0 ? Math.round(((point[c.id] as number) / total) * 1000) / 10 : 0;
    });
    return sp;
  });

  // ── Metrics ─────────────────────────────────────────────────
  const totalBallots = sortedBallots.length;
  const maxCount = Math.max(...activityData.map((d) => d.count), 0);
  const peakBucket = activityData.find((d) => d.count === maxCount);
  const peakHourConcentration = totalBallots > 0 ? (maxCount / totalBallots) * 100 : 0;
  const peakHourLabel = peakBucket?.label ?? '—';

  // Velocity trend: 2nd half rate vs 1st half rate
  let velocityRatio = 1;
  if (totalBallots >= 4) {
    const mid = Math.floor(totalBallots / 2);
    const t0 = firstMs;
    const tM = new Date(sortedBallots[mid]!.createdAt).getTime();
    const tE = lastMs;
    const firstHalfDur = tM - t0;
    const secondHalfDur = tE - tM;
    const r1 = firstHalfDur > 0 ? mid / firstHalfDur : 0;
    const r2 = secondHalfDur > 0 ? (totalBallots - mid) / secondHalfDur : 0;
    velocityRatio = r1 > 0 ? r2 / r1 : 1;
  }

  // Median vote time percentile
  const medianIdx = Math.floor(totalBallots / 2);
  const tMedian = new Date(sortedBallots[medianIdx]!.createdAt).getTime();
  const medianTimePercentile =
    totalDurationMs > 0 ? ((tMedian - firstMs) / totalDurationMs) * 100 : 50;

  // Metrics requiring decryption
  let normalizedEntropy: number | null = null;
  let enc: number | null = null;
  let gini: number | null = null;
  let leadingMargin: number | null = null;
  let frontrunnerChanges: number | null = null;

  if (decryptionDone) {
    const total = Object.values(voteCounts).reduce((a, b) => a + b, 0);

    if (total > 0 && choices.length > 1) {
      // Shannon normalized entropy
      let H = 0;
      choices.forEach((c) => {
        const p = voteCounts[c.id]! / total;
        if (p > 0) H -= p * Math.log2(p);
      });
      normalizedEntropy = H / Math.log2(choices.length);

      // HHI & ENC (Laakso-Taagepera)
      let hhi = 0;
      choices.forEach((c) => {
        const s = voteCounts[c.id]! / total;
        hhi += s * s;
      });
      enc = hhi > 0 ? 1 / hhi : choices.length;

      // Gini coefficient
      const sortedVotes = [...Object.values(voteCounts)].sort((a, b) => a - b);
      const n = sortedVotes.length;
      let gNum = 0;
      sortedVotes.forEach((v, i) => {
        gNum += (2 * (i + 1) - n - 1) * v;
      });
      gini = Math.abs(gNum / (n * total));

      // Leading margin
      const byVotes = [...choices].sort((a, b) => voteCounts[b.id]! - voteCounts[a.id]!);
      leadingMargin =
        ((voteCounts[byVotes[0]!.id]! - (voteCounts[byVotes[1]?.id ?? ''] ?? 0)) / total) * 100;

      // Frontrunner stability: count lead changes
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
    } as AnalyticsMetrics,
  };
}

// ─────────────────────────────────────────────────────────────
// PNG Download
// ─────────────────────────────────────────────────────────────

async function downloadChartAsPng(
  containerRef: React.RefObject<HTMLDivElement | null>,
  title: string,
  electionId: string,
  choices: ElectionChoice[],
  chartTitle: string,
) {
  const container = containerRef.current;
  if (!container) return;
  const svgEl = container.querySelector('svg');
  if (!svgEl) return;

  const W = svgEl.clientWidth || 800;
  const H = svgEl.clientHeight || 400;
  const SCALE = 2;
  const HEADER = 90;
  const LEGEND_H = Math.ceil(choices.length / 4) * 28 + 20;
  const FOOTER = 44;
  const PAD = 24;
  const TOTAL_W = (W + PAD * 2) * SCALE;
  const TOTAL_H = (HEADER + H + LEGEND_H + FOOTER) * SCALE;

  // Serialize SVG to base64 data URL (handles special chars)
  const svgClone = svgEl.cloneNode(true) as SVGSVGElement;
  svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svgClone.style.background = '#ffffff';
  const svgStr = new XMLSerializer().serializeToString(svgClone);
  const svgB64 = btoa(unescape(encodeURIComponent(svgStr)));
  const svgUrl = `data:image/svg+xml;base64,${svgB64}`;

  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = TOTAL_W;
      canvas.height = TOTAL_H;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(SCALE, SCALE);

      const fullW = TOTAL_W / SCALE;

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, fullW, TOTAL_H / SCALE);

      // Navy header
      const headerGrad = ctx.createLinearGradient(0, 0, fullW, 0);
      headerGrad.addColorStop(0, '#1c396e');
      headerGrad.addColorStop(1, '#1062a3');
      ctx.fillStyle = headerGrad;
      ctx.fillRect(0, 0, fullW, HEADER);

      // Header text – chart title
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 16px -apple-system, Arial, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText(chartTitle, PAD, 24);

      // Election title (truncated)
      const maxTitleW = fullW - PAD * 2 - 100;
      ctx.font = `bold 13px -apple-system, Arial, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      let displayTitle = title;
      while (ctx.measureText(displayTitle).width > maxTitleW && displayTitle.length > 10) {
        displayTitle = displayTitle.slice(0, -1);
      }
      if (displayTitle !== title) displayTitle += '…';
      ctx.fillText(displayTitle, PAD, 50);

      // Election ID
      ctx.font = `11px monospace`;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(`ID: ${electionId}`, PAD, 72);

      // Surface area for chart
      ctx.fillStyle = '#f6f8fc';
      ctx.fillRect(0, HEADER, fullW, H + LEGEND_H);

      // Draw chart
      ctx.drawImage(img, PAD, HEADER, W, H);

      // Diagonal watermark across chart area
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = '#1c396e';
      ctx.font = `bold 52px -apple-system, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.translate(fullW / 2, HEADER + H / 2);
      ctx.rotate(-Math.PI / 5);
      ctx.fillText(APP_NAME, 0, 0);
      ctx.restore();

      // Legend
      const legendY = HEADER + H + 12;
      const colW = fullW / 4;
      choices.forEach((c, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const lx = PAD + col * colW;
        const ly = legendY + row * 26;
        ctx.fillStyle = CHOICE_COLORS[i % CHOICE_COLORS.length]!;
        ctx.beginPath();
        ctx.arc(lx + 6, ly + 8, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#374151';
        ctx.font = `12px -apple-system, Arial, sans-serif`;
        ctx.textBaseline = 'middle';
        const lbl = c.choice.length > 28 ? c.choice.slice(0, 25) + '…' : c.choice;
        ctx.fillText(lbl, lx + 18, ly + 8);
      });

      // Footer
      const footerY = HEADER + H + LEGEND_H;
      ctx.fillStyle = '#f0f4fa';
      ctx.fillRect(0, footerY, fullW, FOOTER);
      ctx.strokeStyle = '#dde5f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, footerY);
      ctx.lineTo(fullW, footerY);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = `10px -apple-system, Arial, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `${APP_NAME} · Система голосування · ${new Date().toLocaleString('uk-UA')}`,
        PAD,
        footerY + FOOTER / 2,
      );

      // Download
      const link = document.createElement('a');
      const fname = `${APP_NAME}-${chartTitle.toLowerCase().replace(/\s+/g, '-')}-${electionId.slice(0, 8)}.png`;
      link.download = fname;
      link.href = canvas.toDataURL('image/png');
      link.click();
      resolve();
    };
    img.onerror = reject;
    img.src = svgUrl;
  });
}

// ─────────────────────────────────────────────────────────────
// CSV Export
// ─────────────────────────────────────────────────────────────

function downloadCsv(
  ballots: Ballot[],
  decryptedMap: DecryptedMap,
  selectedFields: Set<string>,
  electionId: string,
) {
  const headers = CSV_FIELDS.filter((f) => selectedFields.has(f.key)).map((f) => f.label);
  const rows = ballots.map((ballot, i) => {
    const dec = decryptedMap.get(ballot.id);
    const row: string[] = [];
    CSV_FIELDS.filter((f) => selectedFields.has(f.key)).forEach(({ key }) => {
      switch (key) {
        case 'index':
          row.push(String(i + 1));
          break;
        case 'currentHash':
          row.push(ballot.currentHash);
          break;
        case 'previousHash':
          row.push(ballot.previousHash ?? '');
          break;
        case 'createdAt':
          row.push(ballot.createdAt);
          break;
        case 'signature':
          row.push(ballot.signature);
          break;
        case 'encryptedBallot':
          row.push(ballot.encryptedBallot);
          break;
        case 'decryptedChoiceIds':
          row.push(dec?.choiceIds?.join('; ') ?? '');
          break;
        case 'decryptedChoiceLabels':
          row.push(dec?.choiceLabels?.join('; ') ?? '');
          break;
        case 'hashValid':
          row.push(dec !== undefined ? (dec.hashValid ? 'TRUE' : 'FALSE') : '');
          break;
        case 'ballotValid':
          row.push(dec !== undefined ? (dec.valid ? 'TRUE' : 'FALSE') : '');
          break;
      }
    });
    return row;
  });

  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${APP_NAME}-ballots-${electionId.slice(0, 8)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle: string;
  color?: 'navy' | 'orange' | 'blue' | 'success' | 'warning' | 'error' | 'neutral';
  locked?: boolean;
  tooltip?: string;
}

function MetricCard({
  icon,
  label,
  value,
  subtitle,
  color = 'navy',
  locked,
  tooltip,
}: MetricCardProps) {
  const [showTip, setShowTip] = useState(false);

  const colorMap = {
    navy: { bg: 'bg-kpi-navy/8', icon: 'text-kpi-navy', border: 'border-kpi-navy/15' },
    orange: { bg: 'bg-kpi-orange/8', icon: 'text-kpi-orange', border: 'border-kpi-orange/15' },
    blue: {
      bg: 'bg-kpi-blue-light/8',
      icon: 'text-kpi-blue-light',
      border: 'border-kpi-blue-light/15',
    },
    success: { bg: 'bg-success/8', icon: 'text-success', border: 'border-success/15' },
    warning: { bg: 'bg-warning/8', icon: 'text-warning', border: 'border-warning/15' },
    error: { bg: 'bg-error/8', icon: 'text-error', border: 'border-error/15' },
    neutral: { bg: 'bg-surface', icon: 'text-kpi-gray-mid', border: 'border-border-subtle' },
  };
  const c = colorMap[color];

  return (
    <div
      className={cn(
        'relative rounded-xl border bg-white p-5',
        'shadow-shadow-sm hover:shadow-shadow-md transition-shadow duration-200',
        c.border,
      )}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', c.bg)}>
          <span className={c.icon}>{icon}</span>
        </div>
        {tooltip && (
          <div className="relative">
            <button
              onMouseEnter={() => setShowTip(true)}
              onMouseLeave={() => setShowTip(false)}
              className="text-kpi-gray-mid hover:text-muted-foreground transition-colors"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
            {showTip && (
              <div className="border-border-color text-muted-foreground shadow-shadow-lg absolute top-5 right-0 z-20 w-52 rounded-lg border bg-white p-2.5 text-[11px] leading-relaxed">
                {tooltip}
              </div>
            )}
          </div>
        )}
      </div>

      {locked ? (
        <div className="flex items-center gap-1.5">
          <Unlock className="text-kpi-gray-light h-4 w-4" />
          <span className="font-body text-kpi-gray-mid text-sm">Потребує дешифрування</span>
        </div>
      ) : (
        <>
          <p className="font-display text-foreground text-2xl leading-none font-bold">{value}</p>
          <p className="font-body text-muted-foreground mt-1.5 text-xs leading-snug">{subtitle}</p>
        </>
      )}
      <p className="font-body text-muted-foreground mt-3 text-[10px] font-semibold tracking-wider uppercase">
        {label}
      </p>
    </div>
  );
}

function CustomLineTooltip({ active, payload, label, choices }: Record<string, unknown>) {
  if (!active || !payload || !(payload as unknown[]).length) return null;
  return (
    <div className="border-border-color shadow-shadow-lg rounded-xl border bg-white p-3 text-xs">
      <p className="font-body text-muted-foreground mb-2 font-semibold">{label as string}</p>
      {(payload as { dataKey: string; value: number; color: string }[]).map((entry) => {
        const choice = (choices as ElectionChoice[]).find((c) => c.id === entry.dataKey);
        if (!choice && entry.dataKey !== 'total') return null;
        return (
          <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground max-w-35 truncate">
              {choice?.choice ?? 'Всього'}
            </span>
            <span className="font-display text-foreground ml-auto font-bold">{entry.value}</span>
          </div>
        );
      })}
    </div>
  );
}

function CustomBarTooltip({ active, payload, label }: Record<string, unknown>) {
  if (!active || !payload || !(payload as unknown[]).length) return null;
  const count = (payload as { value: number }[])[0]?.value ?? 0;
  return (
    <div className="border-border-color shadow-shadow-lg rounded-xl border bg-white p-3 text-xs">
      <p className="font-body text-muted-foreground mb-1 font-semibold">{label as string}</p>
      <p className="font-display text-kpi-navy text-lg font-bold">{count}</p>
      <p className="text-muted-foreground">{pluralize(count, ['голос', 'голоси', 'голосів'])}</p>
    </div>
  );
}

function CustomShareTooltip({ active, payload, label, choices }: Record<string, unknown>) {
  if (!active || !payload || !(payload as unknown[]).length) return null;
  return (
    <div className="border-border-color shadow-shadow-lg min-w-45 rounded-xl border bg-white p-3 text-xs">
      <p className="font-body text-muted-foreground mb-2 font-semibold">{label as string}</p>
      {(payload as { dataKey: string; value: number; color: string }[])
        .slice()
        .reverse()
        .map((entry) => {
          const choice = (choices as ElectionChoice[]).find((c) => c.id === entry.dataKey);
          if (!choice) return null;
          return (
            <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground max-w-30 truncate">{choice.choice}</span>
              <span className="font-display text-foreground ml-auto font-bold">
                {(entry.value as number).toFixed(1)}%
              </span>
            </div>
          );
        })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Chart wrapper with download button
// ─────────────────────────────────────────────────────────────

function ChartWrapper({
  title,
  children,
  onDownload,
  height = 320,
}: {
  title: string;
  children: React.ReactNode;
  onDownload: (ref: React.RefObject<HTMLDivElement | null>) => void;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await onDownload(ref);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-display text-foreground text-base font-semibold">{title}</h3>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150',
            'border-border-subtle bg-surface text-muted-foreground border',
            'hover:border-kpi-navy/30 hover:text-kpi-navy hover:bg-kpi-navy/5',
            downloading && 'cursor-not-allowed opacity-50',
          )}
        >
          <Download className="h-3 w-3" />
          {downloading ? 'Завантаження…' : 'PNG'}
        </button>
      </div>
      <div ref={ref} style={{ height }}>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CSV Export Panel
// ─────────────────────────────────────────────────────────────

function CsvExportPanel({
  ballots,
  decryptedMap,
  decryptionDone,
  electionId,
}: {
  ballots: Ballot[];
  decryptedMap: DecryptedMap;
  decryptionDone: boolean;
  electionId: string;
}) {
  const defaultSelected = new Set(['index', 'currentHash', 'createdAt']);
  const [selected, setSelected] = useState<Set<string>>(defaultSelected);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-foreground flex items-center gap-2 text-base font-semibold">
            <FileSpreadsheet className="text-kpi-orange h-4 w-4" />
            Експорт CSV
          </h3>
          <p className="font-body text-muted-foreground mt-1 text-xs">
            Оберіть поля для включення в файл. Всі дані обробляються локально.
          </p>
        </div>
        <Button
          variant="accent"
          size="sm"
          disabled={selected.size === 0}
          onClick={() => downloadCsv(ballots, decryptedMap, selected, electionId)}
          icon={<Download className="h-3.5 w-3.5" />}
        >
          Завантажити
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CSV_FIELDS.map((field) => {
          const locked = field.requiresDecryption && !decryptionDone;
          return (
            <label
              key={field.key}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-all duration-150',
                locked
                  ? 'border-border-subtle bg-surface cursor-not-allowed opacity-50'
                  : selected.has(field.key)
                    ? 'border-kpi-navy/30 bg-kpi-navy/5'
                    : 'border-border-subtle hover:border-kpi-navy/20 hover:bg-surface bg-white',
              )}
            >
              <input
                type="checkbox"
                checked={selected.has(field.key)}
                disabled={locked}
                onChange={() => !locked && toggle(field.key)}
                className="accent-kpi-navy h-4 w-4 shrink-0"
              />
              <span className="font-body text-foreground text-xs">
                {field.label}
                {field.requiresDecryption && (
                  <span className="text-muted-foreground ml-1">(дешифровано)</span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      <p className="font-body text-muted-foreground mt-3 text-[10px]">
        Обрано полів: {selected.size} · Рядків: {ballots.length.toLocaleString('uk-UA')}
        {selected.size > 0 &&
          ` · Орієнтовний розмір: ~${Math.round((ballots.length * selected.size * 30) / 1024)} KB`}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main AnalyticsPanel
// ─────────────────────────────────────────────────────────────

type ChartTab = 'dynamics' | 'activity' | 'share';

export function AnalyticsPanel({
  ballots,
  decryptedMap,
  decryptionDone,
  isDecrypting,
  onDecrypt,
  choices,
  election,
}: AnalyticsPanelProps) {
  const [chartTab, setChartTab] = useState<ChartTab>('dynamics');

  const { granularity, timeSeries, activityData, shareEvolution, metrics } = useMemo(
    () => computeAnalytics(ballots, decryptedMap, choices, decryptionDone),
    [ballots, decryptedMap, choices, decryptionDone],
  );

  const formatPct = (v: number) => `${Math.round(v * 10) / 10}%`;
  const formatN = (v: number) => Math.round(v * 100) / 100;

  // ── Metric descriptors ──────────────────────────────────────
  const metricsConfig = [
    {
      icon: <Scale className="h-4 w-4" />,
      label: 'Нормалізована ентропія Шеннона',
      value: metrics.normalizedEntropy !== null ? formatPct(metrics.normalizedEntropy * 100) : '—',
      subtitle:
        metrics.normalizedEntropy !== null
          ? metrics.normalizedEntropy > 0.75
            ? 'Висока конкурентність — голоси розподілені рівномірно'
            : metrics.normalizedEntropy > 0.45
              ? 'Помірна конкурентність'
              : 'Низька конкурентність — явний лідер'
          : 'Потребує дешифрування',
      color: 'navy' as const,
      locked: !decryptionDone,
      tooltip:
        'H = -Σ(p·log₂p) / log₂(n). 100% = ідеальна рівність голосів, 0% = однозначний результат. Використовується в теорії інформації для оцінки непередбачуваності.',
    },
    {
      icon: <GitBranch className="h-4 w-4" />,
      label: 'Ефективна кількість конкурентів (ЕКК)',
      value: metrics.enc !== null ? formatN(metrics.enc).toString() : '—',
      subtitle:
        metrics.enc !== null
          ? `Лаксо-Тааґепера: ~${formatN(metrics.enc)} реальних претендентів з ${choices.length}`
          : 'Потребує дешифрування',
      color: 'blue' as const,
      locked: !decryptionDone,
      tooltip:
        'ENC = 1/Σ(sᵢ²), де sᵢ — частка голосів. Індекс Лаксо-Тааґепери з політичної науки. ENC=2 означає реальну боротьбу двох кандидатів.',
    },
    {
      icon: <Scale className="h-4 w-4" />,
      label: 'Коефіцієнт Джині',
      value: metrics.gini !== null ? formatPct(metrics.gini * 100) : '—',
      subtitle:
        metrics.gini !== null
          ? metrics.gini < 0.2
            ? 'Рівномірний розподіл голосів'
            : metrics.gini < 0.5
              ? 'Помірна нерівність розподілу'
              : 'Висока концентрація голосів'
          : 'Потребує дешифрування',
      color:
        metrics.gini !== null && metrics.gini > 0.5 ? ('error' as const) : ('success' as const),
      locked: !decryptionDone,
      tooltip:
        'Класичний показник нерівності, адаптований для голосування. 0% = всі варіанти отримали однакову кількість голосів, 100% = всі голоси за один варіант.',
    },
    {
      icon: <Target className="h-4 w-4" />,
      label: 'Відрив лідера',
      value: metrics.leadingMargin !== null ? `${formatPct(metrics.leadingMargin)}` : '—',
      subtitle:
        metrics.leadingMargin !== null
          ? metrics.leadingMargin < 5
            ? 'Вирішальний результат — практично рівність'
            : metrics.leadingMargin < 15
              ? 'Помірна перевага лідера'
              : 'Переконлива перемога лідера'
          : 'Потребує дешифрування',
      color:
        metrics.leadingMargin !== null && metrics.leadingMargin < 5
          ? ('warning' as const)
          : ('orange' as const),
      locked: !decryptionDone,
      tooltip:
        '(1-й - 2-й) / всього × 100%. Показує, наскільки переконливою є перемога лідера відносно суперника.',
    },
    {
      icon: <Activity className="h-4 w-4" />,
      label: 'Концентрація пікової активності',
      value: metrics.totalBallots > 0 ? formatPct(metrics.peakHourConcentration) : '—',
      subtitle:
        metrics.totalBallots > 0
          ? `${formatPct(metrics.peakHourConcentration)} голосів у ${metrics.peakHourLabel} — ${
              metrics.peakHourConcentration > 40
                ? 'масовий одноразовий наплив'
                : metrics.peakHourConcentration > 20
                  ? 'виражений пік активності'
                  : 'рівномірна активність'
            }`
          : 'Немає даних',
      color: 'navy' as const,
      locked: false,
      tooltip:
        'Відсоток голосів, що припали на найактивніший часовий проміжок. Висока концентрація може вказувати на організовану кампанію або нагадування учасникам.',
    },
    {
      icon: <Zap className="h-4 w-4" />,
      label: 'Тренд швидкості голосування',
      value: metrics.totalBallots >= 4 ? `${formatN(metrics.velocityRatio)}×` : 'Мало даних',
      subtitle:
        metrics.totalBallots >= 4
          ? metrics.velocityRatio > 1.3
            ? 'Прискорення наприкінці голосування'
            : metrics.velocityRatio < 0.7
              ? 'Сповільнення в другій половині'
              : 'Стабільний темп упродовж голосування'
          : 'Потрібно більше голосів',
      color:
        metrics.velocityRatio > 1.3
          ? ('success' as const)
          : metrics.velocityRatio < 0.7
            ? ('warning' as const)
            : ('blue' as const),
      locked: false,
      tooltip:
        'Відношення темпу голосування у 2-й половині до 1-ї. >1 = прискорення (нагадування, кінцевий дедлайн), <1 = основна активність на початку.',
    },
    {
      icon: <Clock className="h-4 w-4" />,
      label: 'Перцентиль медіанного голосу',
      value: metrics.totalBallots > 1 ? formatPct(metrics.medianTimePercentile) : '—',
      subtitle:
        metrics.totalBallots > 1
          ? metrics.medianTimePercentile < 35
            ? 'Рання хвиля — більшість голосів надійшли одразу'
            : metrics.medianTimePercentile > 65
              ? 'Пізня хвиля — більшість голосів ближче до кінця'
              : 'Рівномірна участь упродовж усього часу'
          : 'Недостатньо даних',
      color: 'blue' as const,
      locked: false,
      tooltip:
        'Який відсоток тривалості голосування пройшов, коли надійшов 50-й відсоток бюлетенів. <40% — рання хвиля, >60% — пізня хвиля.',
    },
    {
      icon: <TrendingUp className="h-4 w-4" />,
      label: 'Зміни лідера',
      value: metrics.frontrunnerChanges !== null ? String(metrics.frontrunnerChanges) : '—',
      subtitle:
        metrics.frontrunnerChanges !== null
          ? metrics.frontrunnerChanges === 0
            ? 'Лідер не змінювався — результат передбачуваний'
            : metrics.frontrunnerChanges <= 2
              ? 'Незначна зміна лідера'
              : 'Нестабільне лідерство — висока волатильність'
          : 'Потребує дешифрування',
      color:
        metrics.frontrunnerChanges !== null && metrics.frontrunnerChanges > 3
          ? ('error' as const)
          : metrics.frontrunnerChanges !== null && metrics.frontrunnerChanges > 0
            ? ('warning' as const)
            : ('success' as const),
      locked: !decryptionDone,
      tooltip:
        'Кількість разів, коли перше місце переходило від одного варіанта до іншого в реальному часі. Показник динамічності та непередбачуваності результату.',
    },
  ];

  // ── Granularity label ───────────────────────────────────────
  const granularityLabel = {
    minute: 'по хвилинах',
    hour: 'по годинах',
    '6hour': 'по 6 год.',
    day: 'по днях',
  }[granularity];

  const TABS: { key: ChartTab; label: string; icon: React.ReactNode }[] = [
    { key: 'dynamics', label: 'Динаміка', icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { key: 'activity', label: 'Активність', icon: <BarChart2 className="h-3.5 w-3.5" /> },
    { key: 'share', label: 'Частка голосів', icon: <Activity className="h-3.5 w-3.5" /> },
  ];

  const makeDownloader = useCallback(
    (chartTitle: string) => (ref: React.RefObject<HTMLDivElement | null>) =>
      downloadChartAsPng(ref, election.title, election.id, choices, chartTitle),
    [election.title, election.id, choices],
  );

  // ── Empty state ─────────────────────────────────────────────
  if (ballots.length === 0) {
    return (
      <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-12 text-center">
        <p className="font-display text-foreground text-lg font-semibold">
          Немає даних для аналізу
        </p>
        <p className="font-body text-muted-foreground mt-1 text-sm">Жодного бюлетеня не подано</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Decrypt prompt */}
      {!decryptionDone && (
        <div className="border-kpi-orange/30 rounded-xl border bg-white p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-3">
              <div className="bg-kpi-orange/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                <Unlock className="text-kpi-orange h-5 w-5" />
              </div>
              <div>
                <p className="font-body text-foreground text-sm font-medium">
                  Розшифруйте бюлетені для повної аналітики
                </p>
                <p className="font-body text-muted-foreground mt-0.5 text-xs">
                  Часова аналітика доступна вже зараз. Після дешифрування стануть доступні 4
                  додаткові показники та 2 графіки.
                </p>
              </div>
            </div>
            <Button
              variant="accent"
              size="sm"
              onClick={onDecrypt}
              loading={isDecrypting}
              disabled={isDecrypting}
              icon={<Unlock className="h-3.5 w-3.5" />}
            >
              Розшифрувати
            </Button>
          </div>
        </div>
      )}

      {/* Metrics grid */}
      <div>
        <h2 className="font-display text-foreground mb-4 text-lg font-semibold">
          Аналітичні показники
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metricsConfig.map((m) => (
            <MetricCard key={m.label} {...m} />
          ))}
        </div>
      </div>

      {/* Charts section */}
      <div>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-foreground text-lg font-semibold">Графіки</h2>
          <div className="border-border-subtle bg-surface flex items-center gap-1 rounded-lg border p-1">
            {TABS.map((tab) => {
              const isLocked = tab.key === 'share' && !decryptionDone;
              return (
                <button
                  key={tab.key}
                  onClick={() => !isLocked && setChartTab(tab.key)}
                  disabled={isLocked}
                  className={cn(
                    'flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-all duration-150',
                    chartTab === tab.key
                      ? 'bg-kpi-navy shadow-shadow-xs text-white'
                      : isLocked
                        ? 'text-kpi-gray-light cursor-not-allowed'
                        : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab.icon}
                  {tab.label}
                  {isLocked && <Unlock className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        </div>

        {chartTab === 'dynamics' && (
          <ChartWrapper
            title={`Динаміка голосування (${granularityLabel})`}
            onDownload={makeDownloader('Динаміка голосування')}
            height={340}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeries} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ecf0f7" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#ecf0f7' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={<CustomLineTooltip choices={choices} />}
                  cursor={{ stroke: '#dde5f0', strokeWidth: 1 }}
                />
                {decryptionDone ? (
                  choices.map((c, i) => (
                    <Line
                      key={c.id}
                      type="monotone"
                      dataKey={c.id}
                      stroke={CHOICE_COLORS[i % CHOICE_COLORS.length]}
                      strokeWidth={2}
                      dot={timeSeries.length < 30 ? { r: 3, strokeWidth: 0 } : false}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  ))
                ) : (
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#1c396e"
                    strokeWidth={2.5}
                    dot={timeSeries.length < 30 ? { r: 3, fill: '#1c396e', strokeWidth: 0 } : false}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </ChartWrapper>
        )}

        {chartTab === 'activity' && (
          <ChartWrapper
            title={`Активність голосування (${granularityLabel})`}
            onDownload={makeDownloader('Активність голосування')}
            height={340}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ecf0f7" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#ecf0f7' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: '#f6f8fc' }} />
                {metrics.peakHourLabel !== '—' && (
                  <ReferenceLine
                    x={metrics.peakHourLabel}
                    stroke="#f07d00"
                    strokeDasharray="4 2"
                    label={{ value: 'Пік', fill: '#f07d00', fontSize: 10 }}
                  />
                )}
                <Bar
                  dataKey="count"
                  maxBarSize={60}
                  shape={(props) => {
                    const { x, y, width, height, payload } = props;
                    const isMax = payload.count === metrics.maxCount;

                    return (
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        fill={isMax ? '#f07d00' : '#1c396e'}
                        fillOpacity={isMax ? 1 : 0.7}
                        rx={4}
                        ry={4}
                      />
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartWrapper>
        )}

        {chartTab === 'share' && decryptionDone && (
          <ChartWrapper
            title={`Еволюція частки голосів (${granularityLabel})`}
            onDownload={makeDownloader('Частка голосів')}
            height={340}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={shareEvolution} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  {choices.map((c, i) => (
                    <linearGradient key={c.id} id={`aGrad-${c.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={CHOICE_COLORS[i % CHOICE_COLORS.length]}
                        stopOpacity={0.25}
                      />
                      <stop
                        offset="95%"
                        stopColor={CHOICE_COLORS[i % CHOICE_COLORS.length]}
                        stopOpacity={0.03}
                      />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ecf0f7" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#ecf0f7' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <ReferenceLine
                  y={100 / choices.length}
                  stroke="#94a3b8"
                  strokeDasharray="4 2"
                  label={{ value: 'Рівність', fill: '#94a3b8', fontSize: 10 }}
                />
                <Tooltip
                  content={<CustomShareTooltip choices={choices} />}
                  cursor={{ stroke: '#dde5f0' }}
                />
                {choices.map((c, i) => (
                  <Area
                    key={c.id}
                    type="monotone"
                    dataKey={c.id}
                    stackId="1"
                    stroke={CHOICE_COLORS[i % CHOICE_COLORS.length]}
                    strokeWidth={1.5}
                    fill={`url(#aGrad-${c.id})`}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </ChartWrapper>
        )}
      </div>

      {/* CSV Export */}
      <CsvExportPanel
        ballots={ballots}
        decryptedMap={decryptedMap}
        decryptionDone={decryptionDone}
        electionId={election.id}
      />
    </div>
  );
}
