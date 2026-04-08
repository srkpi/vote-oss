'use client';

import type { LegendEntry } from '@/types/analytics-charts';

export function InlineLegend({ entries }: { entries: LegendEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="border-border-subtle flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t px-4 py-3 sm:px-6">
      {entries.map((entry) => (
        <div key={entry.color + entry.label} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground max-w-40 truncate text-xs">{entry.label}</span>
        </div>
      ))}
    </div>
  );
}

export function drawLegend(
  ctx: CanvasRenderingContext2D,
  entries: LegendEntry[],
  areaX: number,
  areaY: number,
  areaW: number,
): void {
  if (entries.length === 0) return;

  const DOT = 10;
  const GAP = 8;
  const ITEM_PAD = 22;

  ctx.font = `500 13px -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`;
  ctx.textBaseline = 'middle';

  const widths = entries.map((e) => ctx.measureText(e.label).width);
  const totalW = widths.reduce((s, w) => s + DOT + GAP + w + ITEM_PAD, 0) - ITEM_PAD;

  let x = areaX + (areaW - totalW) / 2;
  const y = areaY + 10;

  entries.forEach((entry, i) => {
    ctx.fillStyle = entry.color;
    ctx.beginPath();
    ctx.arc(x + DOT / 2, y + DOT / 2, DOT / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#475569';
    ctx.fillText(entry.label, x + DOT + GAP, y + DOT / 2);

    x += DOT + GAP + widths[i]! + ITEM_PAD;
  });
}
