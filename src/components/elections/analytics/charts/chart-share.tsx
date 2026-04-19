'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ShareTooltip } from '@/components/elections/analytics/charts/chart-tooltipes';
import { CHART_COLORS } from '@/lib/analytics-compute';
import { AXIS_STYLE } from '@/lib/constants';
import type { ChartExportSize, SharePoint } from '@/types/analytics-charts';
import type { ElectionChoice } from '@/types/election';

interface ShareChartProps {
  data: SharePoint[];
  choices: ElectionChoice[];
  exportSize?: ChartExportSize;
  isMultiChoice?: boolean;
}

function ShareChartInner({
  data,
  choices,
  isMultiChoice = false,
  width,
  height,
}: Omit<ShareChartProps, 'exportSize'> & { width?: number; height?: number }) {
  const sizeProps = width != null && height != null ? { width, height } : {};

  return (
    <AreaChart {...sizeProps} data={data} margin={{ top: 8, right: 20, left: -8, bottom: 0 }}>
      <defs>
        {choices.map((c, i) => (
          <linearGradient key={c.id} id={`aGrad-${c.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor={CHART_COLORS[i % CHART_COLORS.length]}
              stopOpacity={0.15}
            />
            <stop
              offset="95%"
              stopColor={CHART_COLORS[i % CHART_COLORS.length]}
              stopOpacity={0.02}
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

      {!isMultiChoice && (
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
      )}

      <Tooltip content={<ShareTooltip choices={choices} />} cursor={{ stroke: '#dde5f0' }} />

      {choices.map((c, i) => (
        <Area
          key={c.id}
          type="monotone"
          dataKey={c.id}
          stroke={CHART_COLORS[i % CHART_COLORS.length]}
          strokeWidth={1.5}
          isAnimationActive={width == null}
          fill={`url(#aGrad-${c.id})`}
        />
      ))}
    </AreaChart>
  );
}

export function ShareChart({ data, choices, exportSize, isMultiChoice }: ShareChartProps) {
  if (exportSize) {
    return (
      <ShareChartInner
        data={data}
        choices={choices}
        isMultiChoice={isMultiChoice}
        width={exportSize.width}
        height={exportSize.height}
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <ShareChartInner data={data} choices={choices} isMultiChoice={isMultiChoice} />
    </ResponsiveContainer>
  );
}
