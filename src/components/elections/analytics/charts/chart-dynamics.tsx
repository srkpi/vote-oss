'use client';

import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { LineTooltip } from '@/components/elections/analytics/charts/chart-tooltips';
import { getChartTheme } from '@/lib/analytics-compute';
import { AXIS_STYLE } from '@/lib/constants';
import type { AnalyticsTimePoint, ChartExportSize } from '@/types/analytics-charts';
import type { ElectionChoice } from '@/types/election';

interface DynamicsChartProps {
  data: AnalyticsTimePoint[];
  choices: ElectionChoice[];
  decryptionDone: boolean;
  opensAt: string;
  closesAt: string;
  darkMode?: boolean;
  exportSize?: ChartExportSize;
}

// ── Inner chart element (no ResponsiveContainer) ──────────────────────────────
// Accepts optional width/height so it can be used both by ResponsiveContainer
// (which injects them via cloneElement) and by the off-screen export render
// (which passes them explicitly, bypassing ResizeObserver entirely).

function DynamicsChartInner({
  data,
  choices,
  decryptionDone,
  opensAt,
  closesAt,
  width,
  height,
  darkMode = false,
}: Omit<DynamicsChartProps, 'exportSize'> & {
  width?: number;
  height?: number;
}) {
  const chartTheme = getChartTheme(darkMode);
  const sizeProps = width != null && height != null ? { width, height } : {};
  const tickMap = Object.fromEntries(data.map((d) => [d.ms, d.label]));
  const ticks = data.map((d) => d.ms);
  const [currentMs, setCurrentMs] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentMs(Date.now());
  }, []);

  const startMs = new Date(opensAt).getTime();
  const closeMs = new Date(closesAt).getTime();
  const lastDataMs = data.length > 0 ? data[data.length - 1].ms : startMs;
  const endMs = Math.min(currentMs ?? lastDataMs, closeMs);

  // Synthetic boundary points so the line spans from open → now/close.
  // _synthetic flags them so the dot renderer can hide them completely.
  const zeroValues = Object.fromEntries(choices.map((c) => [c.id, 0]));
  const lastPoint = data.length > 0 ? data[data.length - 1] : null;

  const startPoint = {
    ms: startMs,
    label: '',
    total: 0,
    ...zeroValues,
    _synthetic: true,
  };

  const endPoint = {
    ...(lastPoint ?? { ms: endMs, label: '', total: 0, ...zeroValues }),
    ms: endMs,
    label: '',
    _synthetic: true,
  };

  const paddedData = [
    startPoint,
    ...data,
    // Only append if the end boundary is strictly after the last real point
    ...(endMs > (lastPoint?.ms ?? startMs) ? [endPoint] : []),
  ];

  // Custom dot: render nothing for synthetic boundary points, normal dot otherwise
  const makeDot = (color: string, showDots: boolean) => {
    function DotRenderer({
      cx,
      cy,
      payload,
    }: {
      cx?: number;
      cy?: number;
      payload?: { _synthetic?: boolean };
    }) {
      if (payload?._synthetic || !showDots || cx == null || cy == null) return <g />;
      return <circle cx={cx} cy={cy} r={3} fill={color} strokeWidth={0} />;
    }
    return DotRenderer;
  };

  return (
    <LineChart {...sizeProps} data={paddedData} margin={{ top: 8, right: 20, left: -8, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
      <XAxis
        dataKey="ms"
        type="number"
        scale="time"
        domain={[startMs, endMs]}
        ticks={ticks}
        tickFormatter={(ms: number) => tickMap[ms] ?? ''}
        tick={AXIS_STYLE}
        tickLine={false}
        axisLine={{ stroke: chartTheme.grid }}
        interval="preserveStartEnd"
      />
      <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
      <Tooltip
        content={<LineTooltip choices={choices} />}
        cursor={{ stroke: chartTheme.cursorLine, strokeWidth: 1 }}
      />

      {decryptionDone ? (
        choices.map((c, i) => {
          const color = chartTheme.seriesColors[i % chartTheme.seriesColors.length]!;
          const showDots = data.length < 30;
          return (
            <Line
              key={c.id}
              type="monotone"
              dataKey={c.id}
              stroke={color}
              strokeWidth={2.5}
              isAnimationActive={width == null}
              dot={makeDot(color, showDots)}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
            />
          );
        })
      ) : (
        <Line
          type="monotone"
          dataKey="total"
          stroke={chartTheme.fallbackLine}
          strokeWidth={2.5}
          isAnimationActive={width == null}
          dot={makeDot(chartTheme.fallbackLine, data.length < 30)}
          activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
        />
      )}
    </LineChart>
  );
}

export function DynamicsChart({
  data,
  choices,
  decryptionDone,
  opensAt,
  closesAt,
  exportSize,
  darkMode,
}: DynamicsChartProps) {
  if (exportSize) {
    return (
      <DynamicsChartInner
        data={data}
        choices={choices}
        decryptionDone={decryptionDone}
        opensAt={opensAt}
        closesAt={closesAt}
        width={exportSize.width}
        height={exportSize.height}
        darkMode={darkMode}
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <DynamicsChartInner
        data={data}
        choices={choices}
        decryptionDone={decryptionDone}
        opensAt={opensAt}
        closesAt={closesAt}
        darkMode={darkMode}
      />
    </ResponsiveContainer>
  );
}
