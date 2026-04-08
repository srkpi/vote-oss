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

import { Button } from '@/components/ui/button';
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

const EXPORT_W = 1600;
const EXPORT_H = 900; // 16:9
const EXPORT_SCALE = 2; // retina

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs><linearGradient id="navyGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1c396e"/><stop offset="60%" stop-color="#1062a3"/><stop offset="100%" stop-color="#008acf"/></linearGradient></defs><rect width="32" height="32" rx="16" ry="16" fill="url(#navyGradient)"/><g transform="translate(8, 8) scale(0.6667)" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/></g></svg>`;

function loadSvgAsImage(svgStr: string, size: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const b64 = btoa(unescape(encodeURIComponent(svgStr)));
    const img = new Image(size, size);
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/svg+xml;base64,${b64}`;
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
  while (t.length > 3 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

interface LegendEntry {
  color: string;
  label: string;
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  entries: LegendEntry[],
  areaX: number,
  areaY: number,
  areaW: number,
) {
  if (entries.length === 0) return;
  const DOT = 10;
  const GAP = 8;
  const ITEM_PAD = 22;

  ctx.font = `500 13px -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`;
  ctx.textBaseline = 'middle';

  // Measure total width
  let totalW = 0;
  const widths: number[] = entries.map((e) => {
    const tw = ctx.measureText(e.label).width;
    totalW += DOT + GAP + tw + ITEM_PAD;
    return tw;
  });
  totalW -= ITEM_PAD; // remove trailing pad

  let x = areaX + (areaW - totalW) / 2;
  const y = areaY + 10;

  entries.forEach((entry, i) => {
    // Dot
    ctx.fillStyle = entry.color;
    ctx.beginPath();
    ctx.arc(x + DOT / 2, y + DOT / 2, DOT / 2, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.fillStyle = '#475569';
    ctx.fillText(entry.label, x + DOT + GAP, y + DOT / 2);

    x += DOT + GAP + widths[i]! + ITEM_PAD;
  });
}

async function downloadChartAsPng(
  containerRef: React.RefObject<HTMLDivElement | null>,
  election: BallotsElection,
  chartTitle: string,
  legendEntries: LegendEntry[],
) {
  const container = containerRef.current;
  if (!container) return;
  const svgEl = container.querySelector('svg');
  if (!svgEl) return;

  // Layout zones (in logical px at 1x)
  const HEADER_H = 64;
  const LEGEND_H = legendEntries.length > 0 ? 36 : 0;
  const FOOTER_H = 56;
  const CHART_H = EXPORT_H - HEADER_H - LEGEND_H - FOOTER_H;

  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_W * EXPORT_SCALE;
  canvas.height = EXPORT_H * EXPORT_SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, EXPORT_W, EXPORT_H);

  // Subtle grid texture on background
  ctx.strokeStyle = 'rgba(203, 213, 225, 0.4)';
  ctx.lineWidth = 0.5;
  for (let gx = 0; gx <= EXPORT_W; gx += 40) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, EXPORT_H);
    ctx.stroke();
  }
  for (let gy = 0; gy <= EXPORT_H; gy += 40) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(EXPORT_W, gy);
    ctx.stroke();
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, EXPORT_W, HEADER_H);

  // Header bottom border
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, HEADER_H);
  ctx.lineTo(EXPORT_W, HEADER_H);
  ctx.stroke();

  // Logo in header
  const logoImg = await loadSvgAsImage(LOGO_SVG, 64);
  const LOGO_SIZE = 34;
  const logoX = 24;
  const logoY = (HEADER_H - LOGO_SIZE) / 2;
  ctx.drawImage(logoImg, logoX, logoY, LOGO_SIZE, LOGO_SIZE);

  // App name next to logo
  ctx.fillStyle = '#1c396e';
  ctx.font = `700 14px -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(APP_NAME, logoX + LOGO_SIZE + 10, HEADER_H / 2 - 7);

  ctx.fillStyle = '#94a3b8';
  ctx.font = `400 11px -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText('Система голосування', logoX + LOGO_SIZE + 10, HEADER_H / 2 + 9);

  // Divider line between logo block and title
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(220, 14);
  ctx.lineTo(220, HEADER_H - 14);
  ctx.stroke();

  // Chart title (center of remaining header width)
  ctx.fillStyle = '#0f172a';
  ctx.font = `600 16px -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  const titleText = chartTitle;
  const titleX = 240;
  const titleMaxW = EXPORT_W - titleX - 200;
  ctx.fillText(truncateText(ctx, titleText, titleMaxW), titleX, HEADER_H / 2 - 7);

  // Granularity sub-label
  ctx.fillStyle = '#64748b';
  ctx.font = `400 11px -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(truncateText(ctx, election.title, titleMaxW), titleX, HEADER_H / 2 + 9);

  // Date badge in header (right side)
  const dateStr = new Date().toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  ctx.font = `500 11px -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`;
  const dateW = ctx.measureText(dateStr).width;
  const datePadX = 12;
  const dateBadgeW = dateW + datePadX * 2;
  const dateBadgeH = 22;
  const dateBadgeX = EXPORT_W - dateBadgeW - 24;
  const dateBadgeY = (HEADER_H - dateBadgeH) / 2;

  ctx.fillStyle = '#f1f5f9';
  roundRect(ctx, dateBadgeX, dateBadgeY, dateBadgeW, dateBadgeH, 6);
  ctx.fill();

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  roundRect(ctx, dateBadgeX, dateBadgeY, dateBadgeW, dateBadgeH, 6);
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.textBaseline = 'middle';
  ctx.fillText(dateStr, dateBadgeX + datePadX, dateBadgeY + dateBadgeH / 2);

  const CARD_MARGIN = 20;
  const cardX = CARD_MARGIN;
  const cardY = HEADER_H + CARD_MARGIN;
  const cardW = EXPORT_W - CARD_MARGIN * 2;
  const cardH = CHART_H + LEGEND_H - CARD_MARGIN * 2;

  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(15, 23, 42, 0.06)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, cardX, cardY, cardW, cardH, 12);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  roundRect(ctx, cardX, cardY, cardW, cardH, 12);
  ctx.stroke();

  const svgClone = svgEl.cloneNode(true) as SVGSVGElement;
  svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svgClone.setAttribute('width', String(cardW - 40));
  svgClone.setAttribute('height', String(CHART_H - CARD_MARGIN * 2 - 16));
  svgClone.style.background = 'transparent';

  const svgStr = new XMLSerializer().serializeToString(svgClone);
  const svgB64 = btoa(unescape(encodeURIComponent(svgStr)));
  const svgUrl = `data:image/svg+xml;base64,${svgB64}`;

  await new Promise<void>((resolve, reject) => {
    const chartImg = new Image();
    chartImg.onload = () => {
      ctx.drawImage(chartImg, cardX + 20, cardY + 16, cardW - 40, CHART_H - CARD_MARGIN * 2 - 16);
      resolve();
    };
    chartImg.onerror = reject;
    chartImg.src = svgUrl;
  });

  if (legendEntries.length > 0) {
    const legendY = cardY + cardH - LEGEND_H + 4;
    // Subtle separator
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + 24, legendY - 4);
    ctx.lineTo(cardX + cardW - 24, legendY - 4);
    ctx.stroke();

    drawLegend(ctx, legendEntries, cardX, legendY, cardW);
  }

  const footerY = EXPORT_H - FOOTER_H;

  ctx.fillStyle = '#1c396e';
  ctx.fillRect(0, footerY, EXPORT_W, FOOTER_H);

  // Footer left: election title
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `600 13px -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  const footerTitleMaxW = EXPORT_W * 0.55;
  const footerTitle = truncateText(ctx, election.title, footerTitleMaxW);
  ctx.fillText(footerTitle, 28, footerY + FOOTER_H / 2);

  // Footer right: ID tag + url hint
  const shortId = election.id.slice(0, 8).toUpperCase();
  const idLabel = `Голосування · ${shortId}`;

  ctx.font = `500 11px -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  const idW = ctx.measureText(idLabel).width;
  ctx.fillText(idLabel, EXPORT_W - idW - 28, footerY + FOOTER_H / 2 - 6);

  // Generated-by line
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = `400 10px -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`;
  const genLabel = `Згенеровано ${new Date().toLocaleString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  const genW = ctx.measureText(genLabel).width;
  ctx.fillText(genLabel, EXPORT_W - genW - 28, footerY + FOOTER_H / 2 + 9);

  // Footer accent line
  ctx.fillStyle = '#f07d00';
  ctx.fillRect(0, footerY, 4, FOOTER_H);

  const link = document.createElement('a');
  const slug = chartTitle
    .toLowerCase()
    .replace(/[\s·]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  link.download = `${APP_NAME}-${slug}-${shortId}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function LineTooltip({ active, payload, label, choices }: Record<string, unknown>) {
  if (!active || !(payload as unknown[])?.length) return null;
  const entries = payload as { dataKey: string; value: number; color: string }[];
  return (
    <div className="border-border-color shadow-shadow-lg min-w-36 rounded-xl border bg-white p-3.5">
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
              <span className="text-muted-foreground max-w-32 truncate text-xs">
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
              <span className="text-muted-foreground max-w-28 truncate text-xs">
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
  onDownload,
}: {
  title: string;
  children: React.ReactNode;
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
        <Button
          size="xs"
          variant="outline"
          onClick={handleDownload}
          disabled={downloading}
          className={downloading ? 'cursor-not-allowed opacity-50' : ''}
          icon={<Download className="h-4 w-4" />}
        />
      </div>
      {/* 
        The ref wrapper has an explicit height so Recharts never sees -1.
        ResponsiveContainer requires a parent with a concrete height.
      */}
      <div className="px-4 pt-4 pb-2 sm:px-6 sm:pt-5">
        <div ref={ref} className="w-full" style={{ height: 320 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

interface BarShapeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  payload: {
    count: number;
    [key: string]: unknown;
  };
  maxCount: number;
}

function BarShape(props: BarShapeProps) {
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

const AXIS_STYLE = { fontSize: 11, fill: '#94a3b8' };

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

  // Build legend entries for the active chart
  const legendEntries: LegendEntry[] = (() => {
    if (activeTab === 'dynamics' && decryptionDone && choices.length > 1) {
      return choices.map((c, i) => ({
        color: CHART_COLORS[i % CHART_COLORS.length]!,
        label: c.choice,
      }));
    }
    if (activeTab === 'share' && decryptionDone) {
      return choices.map((c, i) => ({
        color: CHART_COLORS[i % CHART_COLORS.length]!,
        label: c.choice,
      }));
    }
    return [];
  })();

  const makeDownloader = useCallback(
    (chartTitle: string) => (ref: React.RefObject<HTMLDivElement | null>) =>
      downloadChartAsPng(ref, election, chartTitle, legendEntries),
    [election, legendEntries],
  );

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

      {activeTab === 'dynamics' && (
        <ChartWrapper
          title={`Динаміка надходження голосів · ${granLabel}`}
          onDownload={makeDownloader(`Динаміка голосування · ${granLabel}`)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeSeries} margin={{ top: 8, right: 20, left: -8, bottom: 0 }}>
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
          onDownload={makeDownloader(`Активність голосування · ${granLabel}`)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={activityData} margin={{ top: 24, right: 20, left: -8, bottom: 0 }}>
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
                  label={{
                    value: 'Пік',
                    fill: '#f07d00',
                    fontSize: 10,
                    fontWeight: 600,
                    position: 'top',
                  }}
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
          onDownload={makeDownloader(`Частка голосів · ${granLabel}`)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={shareEvolution} margin={{ top: 8, right: 20, left: -8, bottom: 0 }}>
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
                label={{
                  value: 'Рівність',
                  fill: '#94a3b8',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
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

      {legendEntries.length > 1 && (
        <div className="flex flex-wrap gap-x-5 gap-y-2 px-1 pt-1">
          {legendEntries.map((entry) => (
            <div key={entry.color + entry.label} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground max-w-40 truncate text-xs">{entry.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
