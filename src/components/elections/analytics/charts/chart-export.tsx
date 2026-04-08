/**
 * PNG export pipeline.
 *
 * Key design decision: instead of cloning the live browser SVG (which is sized
 * to the user's current viewport and therefore always looks stretched or
 * blurry when scaled to a 1600×900 canvas), we re-render the chart component
 * at the exact target pixel dimensions using an off-screen container.
 *
 * How it works:
 *  1. `captureChartSvg` appends a hidden <div> sized to the export chart area,
 *     renders the chart element with explicit width/height (no ResponsiveContainer),
 *     and calls `flushSync` to force a synchronous React commit.
 *  2. Because the chart uses explicit pixel dimensions, Recharts never needs
 *     ResizeObserver, so flushSync produces a fully-painted SVG immediately.
 *  3. The SVG is serialised, drawn onto a 2× retina canvas, and downloaded.
 *
 * The `captureChartSvg` call is intentionally placed *before* any `await`
 * in the pipeline so that it executes in the original event-handler microtask
 * context — a requirement for flushSync.
 */

import type React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { drawLegend } from '@/components/elections/analytics/charts/chart-legend';
import { APP_NAME } from '@/lib/config/client';
import {
  loadSvgAsImage,
  roundRect,
  toBase64,
  truncateText,
} from '@/lib/utils/analytics-chart-utils';
import { formatDateTime } from '@/lib/utils/common';
import type { LegendEntry } from '@/types/analytics-charts';
import type { BallotsElection } from '@/types/ballot';

// ── Export canvas constants ───────────────────────────────────────────────────

const EXPORT_W = 1200;
const EXPORT_H = 675; // 16 : 9
const EXPORT_SCALE = 3; // retina / HiDPI

const HEADER_H = 64;
const CARD_MARGIN = 20;

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#1c396e"/>
      <stop offset="60%"  stop-color="#1062a3"/>
      <stop offset="100%" stop-color="#008acf"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="16" fill="url(#g)"/>
  <g transform="translate(8,8) scale(0.6667)" stroke="white" stroke-width="2"
     stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M21.801 10A10 10 0 1 1 17 3.335"/>
    <path d="m9 11 3 3L22 4"/>
  </g>
</svg>`;

// ── Off-screen render ─────────────────────────────────────────────────────────

/**
 * Renders `element` synchronously in a hidden off-screen container of the
 * given dimensions and returns the first SVG element found inside it.
 *
 * Must be called before any `await` in the export pipeline so that flushSync
 * runs in the original event-handler context.
 */
function captureChartSvg(
  element: React.ReactElement,
  width: number,
  height: number,
): SVGSVGElement {
  const host = document.createElement('div');
  host.style.cssText = [
    'position:fixed',
    `left:${-(width + 200)}px`,
    'top:0',
    `width:${width}px`,
    `height:${height}px`,
    'overflow:hidden',
    'pointer-events:none',
    'visibility:hidden',
  ].join(';');
  document.body.appendChild(host);

  const root = createRoot(host);
  // flushSync forces a synchronous React commit. This works because the chart
  // element uses explicit width/height props — no ResizeObserver is needed.
  flushSync(() => root.render(element));

  const svg = host.querySelector('svg') as SVGSVGElement | null;

  if (!svg) {
    root.unmount();
    document.body.removeChild(host);
    throw new Error('[chart-export] SVG not found in off-screen container');
  }

  // Clone the SVG *before* unmounting — once React unmounts and the host is
  // removed from the DOM, the original node loses its computed styles and
  // serialises as an empty shell. The cloneNode(true) deep-copies all child
  // elements while the host is still attached and painted.
  const cloned = svg.cloneNode(true) as SVGSVGElement;

  root.unmount();
  document.body.removeChild(host);

  return cloned;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * @param renderChart  Factory that receives the exact pixel dimensions of the
 *                     chart area and returns a chart element rendered with those
 *                     explicit dimensions (no ResponsiveContainer).
 * @param chartType    Short slug appended to the filename, e.g. "dynamics".
 */
export async function downloadChartAsPng(
  renderChart: (width: number, height: number) => React.ReactElement,
  election: BallotsElection,
  chartTitle: string,
  legendEntries: LegendEntry[],
  chartType: string,
): Promise<void> {
  // Compute layout zones up-front so we know the chart area size before
  // any async operations.
  const legendH = legendEntries.length > 0 ? 40 : 0;
  const chartZoneH = EXPORT_H - HEADER_H - legendH;

  const cardX = CARD_MARGIN;
  const cardY = HEADER_H + CARD_MARGIN;
  const cardW = EXPORT_W - CARD_MARGIN * 2;
  const cardH = chartZoneH + legendH - CARD_MARGIN * 2;

  const exportChartW = cardW - 40;
  const exportChartH = chartZoneH - CARD_MARGIN * 2 - 16;

  // ── Step 1: render chart off-screen (sync, before any awaits) ─────────────
  const rawSvg = captureChartSvg(
    renderChart(exportChartW, exportChartH),
    exportChartW,
    exportChartH,
  );

  // The SVG was rendered at exactly exportChartW × exportChartH, so viewBox
  // and dimensions match — no stretching, no letter-boxing.
  rawSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  rawSvg.setAttribute('viewBox', `0 0 ${exportChartW} ${exportChartH}`);
  rawSvg.setAttribute('width', String(exportChartW));
  rawSvg.setAttribute('height', String(exportChartH));

  const svgStr = new XMLSerializer().serializeToString(rawSvg);
  const svgB64 = toBase64(svgStr);
  const svgDataUrl = `data:image/svg+xml;base64,${svgB64}`;

  // ── Step 2: build canvas (async — image loading) ───────────────────────────
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_W * EXPORT_SCALE;
  canvas.height = EXPORT_H * EXPORT_SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);

  // Background grid
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, EXPORT_W, EXPORT_H);
  ctx.strokeStyle = 'rgba(203,213,225,0.4)';
  ctx.lineWidth = 0.5;
  for (let gx = 0; gx <= EXPORT_W; gx += 50) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, EXPORT_H);
    ctx.stroke();
  }
  for (let gy = 0; gy <= EXPORT_H; gy += 50) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(EXPORT_W, gy);
    ctx.stroke();
  }

  // Header bar
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, EXPORT_W, HEADER_H);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, HEADER_H);
  ctx.lineTo(EXPORT_W, HEADER_H);
  ctx.stroke();

  // Logo (async)
  const logoImg = await loadSvgAsImage(LOGO_SVG, 64);
  const LOGO_SIZE = 34;
  const logoX = 24;
  const logoY = (HEADER_H - LOGO_SIZE) / 2;
  ctx.drawImage(logoImg, logoX, logoY, LOGO_SIZE, LOGO_SIZE);

  ctx.fillStyle = '#1c396e';
  ctx.font = `700 14px -apple-system,"SF Pro Text","Helvetica Neue",Arial,sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(APP_NAME, logoX + LOGO_SIZE + 10, HEADER_H / 2 - 7);

  ctx.fillStyle = '#94a3b8';
  ctx.font = `400 11px -apple-system,"SF Pro Text","Helvetica Neue",Arial,sans-serif`;
  ctx.fillText('Система голосування', logoX + LOGO_SIZE + 10, HEADER_H / 2 + 9);

  // Separator line
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(220, 14);
  ctx.lineTo(220, HEADER_H - 14);
  ctx.stroke();

  // Date badge (measure first so it doesn't overlap the title)
  const dateStr = formatDateTime(new Date().toISOString());
  ctx.font = `500 11px -apple-system,"SF Pro Text","Helvetica Neue",Arial,sans-serif`;
  const datePadX = 12;
  const dateBadgeW = ctx.measureText(dateStr).width + datePadX * 2;
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

  // Chart title + election name
  const titleX = 240;
  const titleMaxW = dateBadgeX - 16 - titleX;

  ctx.fillStyle = '#0f172a';
  ctx.font = `600 16px -apple-system,"SF Pro Text","Helvetica Neue",Arial,sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(truncateText(ctx, chartTitle, titleMaxW), titleX, HEADER_H / 2 - 7);

  ctx.fillStyle = '#64748b';
  ctx.font = `400 11px -apple-system,"SF Pro Text","Helvetica Neue",Arial,sans-serif`;
  ctx.fillText(truncateText(ctx, election.title, titleMaxW), titleX, HEADER_H / 2 + 9);

  // Chart card background
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(15,23,42,0.06)';
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

  // Draw pre-rendered chart SVG (async — image decode)
  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, cardX + 20, cardY + 16, exportChartW, exportChartH);
      resolve();
    };
    img.onerror = reject;
    img.src = svgDataUrl;
  });

  // Legend strip inside card
  if (legendEntries.length > 0) {
    const legendY = cardY + cardH - legendH + 4;
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + 24, legendY - 4);
    ctx.lineTo(cardX + cardW - 24, legendY - 4);
    ctx.stroke();
    drawLegend(ctx, legendEntries, cardX, legendY, cardW);
  }

  // Download
  const link = document.createElement('a');
  link.download = `${APP_NAME}-${election.id.slice(0, 8).toUpperCase()}-${chartType}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
