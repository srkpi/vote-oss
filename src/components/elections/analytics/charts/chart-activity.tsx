'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { BarTooltip } from '@/components/elections/analytics/charts/chart-tooltips';
import { AXIS_STYLE } from '@/lib/constants';
import type { ActivityPoint, ChartExportSize } from '@/types/analytics-charts';
import type { AnalyticsMetrics } from '@/types/metrics';

interface BarShapeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  payload: { count: number; [key: string]: unknown };
  maxCount: number;
}

function BarShape({ x, y, width, height, payload, maxCount }: BarShapeProps) {
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

interface ActivityChartProps {
  data: ActivityPoint[];
  metrics: AnalyticsMetrics;
  exportSize?: ChartExportSize;
}

function ActivityChartInner({
  data,
  metrics,
  width,
  height,
}: Omit<ActivityChartProps, 'exportSize'> & { width?: number; height?: number }) {
  const sizeProps = width != null && height != null ? { width, height } : {};

  // Build ms→label map so the numeric axis can display formatted ticks
  const tickMap = Object.fromEntries(data.map((d) => [d.ms, d.label]));
  const ticks = data.map((d) => d.ms);

  // Only show Пік when a single bar holds the maximum (no tie for first place)
  const peakBars = data.filter((d) => d.count === metrics.maxCount);
  const hasSinglePeak = peakBars.length === 1;
  const peakMs = hasSinglePeak ? peakBars[0]!.ms : undefined;

  return (
    <BarChart {...sizeProps} data={data} margin={{ top: 24, right: 20, left: -8, bottom: 0 }}>
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
      <Tooltip content={<BarTooltip />} cursor={{ fill: '#f6f8fc' }} />

      {hasSinglePeak && peakMs != null && (
        <ReferenceLine
          x={peakMs}
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
        isAnimationActive={width == null}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        shape={(props: any) => <BarShape {...props} maxCount={metrics.maxCount} />}
      />
    </BarChart>
  );
}

export function ActivityChart({ data, metrics, exportSize }: ActivityChartProps) {
  if (exportSize) {
    return (
      <ActivityChartInner
        data={data}
        metrics={metrics}
        width={exportSize.width}
        height={exportSize.height}
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <ActivityChartInner data={data} metrics={metrics} />
    </ResponsiveContainer>
  );
}
