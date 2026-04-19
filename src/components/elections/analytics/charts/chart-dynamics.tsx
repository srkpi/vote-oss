'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { LineTooltip } from '@/components/elections/analytics/charts/chart-tooltipes';
import { CHART_COLORS } from '@/lib/analytics-compute';
import { AXIS_STYLE } from '@/lib/constants';
import type { AnalyticsTimePoint, ChartExportSize } from '@/types/analytics-charts';
import type { ElectionChoice } from '@/types/election';

interface DynamicsChartProps {
  data: AnalyticsTimePoint[];
  choices: ElectionChoice[];
  decryptionDone: boolean;
  /** When provided the chart renders with explicit pixel dimensions (for PNG export). */
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
  width,
  height,
}: Omit<DynamicsChartProps, 'exportSize'> & { width?: number; height?: number }) {
  const sizeProps = width != null && height != null ? { width, height } : {};
  const tickMap = Object.fromEntries(data.map((d) => [d.ms, d.label]));
  const ticks = data.map((d) => d.ms);

  return (
    <LineChart {...sizeProps} data={data} margin={{ top: 8, right: 20, left: -8, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#ecf0f7" vertical={false} />
      <XAxis
        dataKey="ms"
        type="number"
        scale="time"
        domain={['dataMin', 'dataMax']}
        ticks={ticks}
        tickFormatter={(ms: number) => tickMap[ms] ?? ''}
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
            isAnimationActive={width == null}
            dot={
              data.length < 30
                ? {
                    r: 3,
                    strokeWidth: 0,
                    fill: CHART_COLORS[i % CHART_COLORS.length],
                  }
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
          isAnimationActive={width == null}
          dot={data.length < 30 ? { r: 3, fill: '#1c396e', strokeWidth: 0 } : false}
          activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
        />
      )}
    </LineChart>
  );
}

export function DynamicsChart({ data, choices, decryptionDone, exportSize }: DynamicsChartProps) {
  if (exportSize) {
    return (
      <DynamicsChartInner
        data={data}
        choices={choices}
        decryptionDone={decryptionDone}
        width={exportSize.width}
        height={exportSize.height}
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <DynamicsChartInner data={data} choices={choices} decryptionDone={decryptionDone} />
    </ResponsiveContainer>
  );
}
