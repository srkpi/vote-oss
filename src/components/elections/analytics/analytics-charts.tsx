'use client';

import { Download } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
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

import { Tabs } from '@/components/ui/tabs';
import {
  type ActivityPoint,
  type AnalyticsMetrics,
  type AnalyticsTimePoint,
  CHART_COLORS,
  type ChartGranularity,
  GRANULARITY_LABEL,
  type SharePoint,
} from '@/lib/analytics-compute';
import { APP_NAME } from '@/lib/config/client';
import { cn } from '@/lib/utils';
import type { BallotsElection } from '@/types/ballot';
import type { ElectionChoice } from '@/types/election';

interface ChartsProps {
  timeSeries: AnalyticsTimePoint[];
  activityData: ActivityPoint[];
  shareEvolution: SharePoint[];
  granularity: ChartGranularity;
  metrics: AnalyticsMetrics;
  choices: ElectionChoice[];
  election: BallotsElection;
  decryptionDone: boolean;
}

type ChartTab = 'dynamics' | 'activity' | 'share';

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs><linearGradient id="navyGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1c396e"/><stop offset="60%" stop-color="#1062a3"/><stop offset="100%" stop-color="#008acf"/></linearGradient></defs><rect width="32" height="32" rx="16" ry="16" fill="url(#navyGradient)"/><g transform="translate(8, 8) scale(0.6667)" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/></g></svg>`;

async function downloadChartAsPng(
  containerRef: React.RefObject<HTMLDivElement | null>,
  election: BallotsElection,
  chartTitle: string,
) {
  const container = containerRef.current;
  if (!container) return;
  const svgEl = container.querySelector('svg');
  if (!svgEl) return;

  const W = svgEl.clientWidth || 800;
  const H = svgEl.clientHeight || 400;
  const SCALE = 2;
  const FOOTER_H = 32;
  const BRAND_PAD = 12;

  const TOTAL_W = W * SCALE;
  const TOTAL_H = (H + FOOTER_H) * SCALE;

  // Serialize chart SVG
  const svgClone = svgEl.cloneNode(true) as SVGSVGElement;
  svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svgClone.style.background = '#ffffff';
  const svgStr = new XMLSerializer().serializeToString(svgClone);
  const svgB64 = btoa(String.fromCharCode(...new TextEncoder().encode(svgStr)));
  const svgUrl = `data:image/svg+xml;base64,${svgB64}`;

  // Prepare logo
  const logoB64 = btoa(String.fromCharCode(...new TextEncoder().encode(LOGO_SVG)));
  const logoUrl = `data:image/svg+xml;base64,${logoB64}`;

  await new Promise<void>((resolve, reject) => {
    const chartImg = new Image();
    chartImg.onload = () => {
      const logoImg = new Image();
      logoImg.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = TOTAL_W;
        canvas.height = TOTAL_H;
        const ctx = canvas.getContext('2d')!;
        ctx.scale(SCALE, SCALE);

        const fw = TOTAL_W / SCALE;
        const fh = TOTAL_H / SCALE;

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, fw, fh);

        // Chart
        ctx.drawImage(chartImg, 0, 0, W, H);

        // Branded overlay panel (top-left corner)
        const PANEL_W = 148;
        const PANEL_H = 38;
        const px = BRAND_PAD;
        const py = BRAND_PAD;

        // Panel background (frosted-like: white with border)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        roundRect(ctx, px, py, PANEL_W, PANEL_H, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(221, 229, 240, 0.9)';
        ctx.lineWidth = 1;
        roundRect(ctx, px, py, PANEL_W, PANEL_H, 8);
        ctx.stroke();

        // Logo circle
        const LOGO_SIZE = 24;
        const lx = px + 8;
        const ly = py + (PANEL_H - LOGO_SIZE) / 2;

        ctx.beginPath();
        ctx.arc(lx + LOGO_SIZE / 2, ly + LOGO_SIZE / 2, LOGO_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(logoImg, lx, ly, LOGO_SIZE, LOGO_SIZE);

        // App name text
        const tx = lx + LOGO_SIZE + 7;
        ctx.fillStyle = '#1c396e';
        ctx.font = `bold 11px -apple-system, Arial, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(APP_NAME, tx, py + 9);

        ctx.fillStyle = '#94a3b8';
        ctx.font = `10px -apple-system, Arial, sans-serif`;
        ctx.fillText('Система голосування', tx, py + 22);

        // ── Footer strip
        const fy = H;
        ctx.fillStyle = '#f6f8fc';
        ctx.fillRect(0, fy, fw, FOOTER_H);

        ctx.strokeStyle = '#dde5f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, fy);
        ctx.lineTo(fw, fy);
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = `10px -apple-system, Arial, sans-serif`;
        ctx.textBaseline = 'middle';

        const titleTrunc = truncateText(ctx, election.title, fw * 0.5);
        ctx.fillText(titleTrunc, 12, fy + FOOTER_H / 2);

        ctx.fillStyle = '#94a3b8';
        const rightText = `#${election.id.slice(0, 8).toUpperCase()} · ${new Date().toLocaleDateString('uk-UA')}`;
        const rightW = ctx.measureText(rightText).width;
        ctx.fillText(rightText, fw - rightW - 12, fy + FOOTER_H / 2);

        // Download
        const link = document.createElement('a');
        link.download = `${APP_NAME}-${chartTitle.toLowerCase().replace(/\s+/g, '-')}-${election.id.slice(0, 8)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        resolve();
      };
      logoImg.onerror = reject;
      logoImg.src = logoUrl;
    };
    chartImg.onerror = reject;
    chartImg.src = svgUrl;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 3 && ctx.measureText(t + '…').width > maxW) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

function LineTooltip({ active, payload, label, choices }: Record<string, unknown>) {
  if (!active || !(payload as unknown[])?.length) return null;
  const entries = payload as { dataKey: string; value: number; color: string }[];
  return (
    <div className="border-border-color shadow-shadow-lg min-w-35 rounded-xl border bg-white p-3.5">
      <p className="font-body text-muted-foreground mb-2.5 text-xs font-semibold">
        {label as string}
      </p>
      <div className="space-y-1.5">
        {entries.map((entry) => {
          const choice = (choices as ElectionChoice[]).find((c) => c.id === entry.dataKey);
          if (!choice && entry.dataKey !== 'total') return null;
          return (
            <div key={entry.dataKey} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground max-w-30 truncate text-xs">
                {choice?.choice ?? 'Всього'}
              </span>
              <span className="font-display text-foreground ml-auto text-xs font-bold tabular-nums">
                {entry.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BarTooltip({ active, payload, label }: Record<string, unknown>) {
  if (!active || !(payload as unknown[])?.length) return null;
  const count = (payload as { value: number }[])[0]?.value ?? 0;
  return (
    <div className="border-border-color shadow-shadow-lg rounded-xl border bg-white p-3.5">
      <p className="font-body text-muted-foreground mb-1 text-xs font-semibold">
        {label as string}
      </p>
      <p className="font-display text-kpi-navy text-2xl leading-none font-bold">{count}</p>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {count === 1 ? 'голос' : count < 5 ? 'голоси' : 'голосів'}
      </p>
    </div>
  );
}

function ShareTooltip({ active, payload, label, choices }: Record<string, unknown>) {
  if (!active || !(payload as unknown[])?.length) return null;
  const entries = (payload as { dataKey: string; value: number; color: string }[])
    .slice()
    .reverse();
  return (
    <div className="border-border-color shadow-shadow-lg min-w-40 rounded-xl border bg-white p-3.5">
      <p className="font-body text-muted-foreground mb-2.5 text-xs font-semibold">
        {label as string}
      </p>
      <div className="space-y-1.5">
        {entries.map((entry) => {
          const choice = (choices as ElectionChoice[]).find((c) => c.id === entry.dataKey);
          if (!choice) return null;
          return (
            <div key={entry.dataKey} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground max-w-25 truncate text-xs">
                {choice.choice}
              </span>
              <span className="font-display text-foreground ml-auto text-xs font-bold tabular-nums">
                {(entry.value as number).toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChartWrapper({
  title,
  children,
  height = 320,
  onDownload,
}: {
  title: string;
  children: React.ReactNode;
  height?: number;
  onDownload: (ref: React.RefObject<HTMLDivElement | null>) => Promise<void>;
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
    <div className="border-border-color shadow-shadow-sm overflow-hidden rounded-xl border bg-white">
      <div className="border-border-subtle flex items-center justify-between border-b px-6 py-4">
        <h3 className="font-display text-foreground text-sm font-semibold">{title}</h3>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150',
            'border-border-subtle bg-surface text-muted-foreground border',
            'hover:border-kpi-navy/30 hover:text-kpi-navy hover:bg-kpi-navy/5',
            downloading && 'cursor-not-allowed opacity-50',
          )}
        >
          <Download className="h-3 w-3" />
          {downloading ? 'Зберігаємо…' : 'PNG'}
        </button>
      </div>
      <div className="p-4 sm:p-6">
        <div ref={ref} style={{ height }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BarShape(props: any) {
  const { x, y, width, height, payload, maxCount } = props;
  if (!height || height <= 0) return null;
  const isMax = payload.count === maxCount;
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
}

export function AnalyticsCharts({
  timeSeries,
  activityData,
  shareEvolution,
  granularity,
  metrics,
  choices,
  election,
  decryptionDone,
}: ChartsProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>('dynamics');

  const tabs = [
    { key: 'dynamics' as const, label: 'Динаміка' },
    { key: 'activity' as const, label: 'Активність' },
    ...(decryptionDone ? [{ key: 'share' as const, label: 'Частка' }] : []),
  ];

  const tabCount = (key: ChartTab): number => {
    if (key === 'dynamics') return timeSeries.length;
    if (key === 'activity') return activityData.length;
    if (key === 'share') return choices.length;
    return 0;
  };

  const granLabel = GRANULARITY_LABEL[granularity];

  const makeDownloader = useCallback(
    (chartTitle: string) => (ref: React.RefObject<HTMLDivElement | null>) =>
      downloadChartAsPng(ref, election, chartTitle),
    [election],
  );

  const AXIS_STYLE = { fontSize: 11, fill: '#94a3b8' };

  return (
    <div className="space-y-4">
      {/* Tab header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-foreground text-lg font-semibold">Графіки</h2>
        <div className="w-full sm:w-auto sm:min-w-70">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(key) => setActiveTab(key as ChartTab)}
            tabCount={(key) => tabCount(key as ChartTab)}
          />
        </div>
      </div>

      {/* Charts */}
      {activeTab === 'dynamics' && (
        <ChartWrapper
          title={`Динаміка надходження голосів · ${granLabel}`}
          onDownload={makeDownloader('Динаміка голосування')}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeSeries} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ecf0f7" vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_STYLE}
                tickLine={false}
                axisLine={{ stroke: '#ecf0f7' }}
                interval="preserveStartEnd"
              />
              <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                content={<LineTooltip choices={choices} />}
                cursor={{ stroke: '#dde5f0', strokeWidth: 1 }}
              />
              {decryptionDone ? (
                choices.map((c, i) => (
                  <Line
                    key={c.id}
                    type="monotone"
                    dataKey={c.id}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2.5}
                    dot={
                      timeSeries.length < 30
                        ? { r: 3, strokeWidth: 0, fill: CHART_COLORS[i % CHART_COLORS.length] }
                        : false
                    }
                    activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                  />
                ))
              ) : (
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#1c396e"
                  strokeWidth={2.5}
                  dot={timeSeries.length < 30 ? { r: 3, fill: '#1c396e', strokeWidth: 0 } : false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </ChartWrapper>
      )}

      {activeTab === 'activity' && (
        <ChartWrapper
          title={`Активність голосування · ${granLabel}`}
          onDownload={makeDownloader('Активність голосування')}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={activityData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ecf0f7" vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_STYLE}
                tickLine={false}
                axisLine={{ stroke: '#ecf0f7' }}
                interval="preserveStartEnd"
              />
              <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<BarTooltip />} cursor={{ fill: '#f6f8fc' }} />
              {metrics.peakHourLabel && (
                <ReferenceLine
                  x={metrics.peakHourLabel}
                  stroke="#f07d00"
                  strokeDasharray="4 2"
                  label={{ value: 'Пік', fill: '#f07d00', fontSize: 10, fontWeight: 600 }}
                />
              )}
              <Bar
                dataKey="count"
                maxBarSize={56}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                shape={(props: any) => <BarShape {...props} maxCount={metrics.maxCount} />}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartWrapper>
      )}

      {activeTab === 'share' && decryptionDone && (
        <ChartWrapper
          title={`Еволюція частки голосів · ${granLabel}`}
          onDownload={makeDownloader('Частка голосів')}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={shareEvolution} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <defs>
                {choices.map((c, i) => (
                  <linearGradient key={c.id} id={`aGrad-${c.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={CHART_COLORS[i % CHART_COLORS.length]}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={CHART_COLORS[i % CHART_COLORS.length]}
                      stopOpacity={0.04}
                    />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ecf0f7" vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_STYLE}
                tickLine={false}
                axisLine={{ stroke: '#ecf0f7' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={AXIS_STYLE}
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
                content={<ShareTooltip choices={choices} />}
                cursor={{ stroke: '#dde5f0' }}
              />
              {choices.map((c, i) => (
                <Area
                  key={c.id}
                  type="monotone"
                  dataKey={c.id}
                  stackId="1"
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={1.5}
                  fill={`url(#aGrad-${c.id})`}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartWrapper>
      )}

      {/* Legend for decrypted multi-choice charts */}
      {(activeTab === 'dynamics' || activeTab === 'share') &&
        decryptionDone &&
        choices.length > 1 && (
          <div className="flex flex-wrap gap-x-4 gap-y-2 px-1">
            {choices.map((c, i) => (
              <div key={c.id} className="flex items-center gap-1.5">
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                <span className="text-muted-foreground max-w-40 truncate text-xs">{c.choice}</span>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
