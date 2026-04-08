'use client';

import { Download } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { InlineLegend } from '@/components/elections/analytics/charts/chart-legend';
import { Button } from '@/components/ui/button';
import type { LegendEntry } from '@/types/analytics-charts';

/**
 * Defers mounting chart children until the container has a positive clientWidth.
 *
 * Why rAF instead of ResizeObserver or immediate clientWidth check:
 * - On initial render the browser hasn't run its layout pass yet, so
 *   clientWidth === 0 even though the element is in the DOM.
 * - ResizeObserver fires *during* the layout pass — Recharts can still receive
 *   a zero-width measurement if it mounts in the same microtask.
 * - A single requestAnimationFrame fires *after* the browser's layout+paint,
 *   so clientWidth is always positive by then. We check once; if still 0
 *   (extremely rare — hidden parent), we fall back to ResizeObserver.
 *
 * Children are only mounted after we have a valid size, so Recharts's
 * ResponsiveContainer never sees width < 1 and the "width(-1)" warning
 * is fully eliminated.
 */
function DeferredChartArea({
  height,
  containerRef,
  children,
}: {
  height: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const [hasSize, setHasSize] = useState(false);

  useEffect(() => {
    // Reset on re-mount (tab switch remounts this component).
    setHasSize(false);

    let rafId: number | undefined = undefined;
    let obs: ResizeObserver | null = null;

    const check = () => {
      const el = containerRef.current;
      if (!el) return;
      if (el.clientWidth > 0) {
        setHasSize(true);
        obs?.disconnect();
        return;
      }
      // Width still 0 — element is inside a hidden/collapsed ancestor.
      // Fall back to ResizeObserver to catch when it eventually gets laid out.
      if (!obs) {
        obs = new ResizeObserver(() => {
          if ((containerRef.current?.clientWidth ?? 0) > 0) {
            setHasSize(true);
            obs?.disconnect();
          }
        });
        obs.observe(el);
      }
    };

    // One rAF is enough for the common case (element is visible on mount).
    rafId = requestAnimationFrame(check);

    return () => {
      cancelAnimationFrame(rafId);
      obs?.disconnect();
    };
    // containerRef is a stable ref object — intentionally omitted from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        height,
        width: '100%',
        // Prevents flex children from overflowing their track — the original
        // trigger for Recharts reporting a negative width.
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      {hasSize ? children : null}
    </div>
  );
}

interface ChartWrapperProps {
  title: string;
  children: React.ReactNode;
  onDownload: () => Promise<void>;
  legend?: LegendEntry[];
  chartHeight?: number;
}

export function ChartWrapper({
  title,
  children,
  onDownload,
  legend,
  chartHeight = 320,
}: ChartWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await onDownload();
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

      <div className="px-4 pt-4 pb-2 sm:px-6 sm:pt-5">
        <DeferredChartArea height={chartHeight} containerRef={containerRef}>
          {children}
        </DeferredChartArea>
      </div>

      {legend && legend.length > 1 && <InlineLegend entries={legend} />}
    </div>
  );
}
