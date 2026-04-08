'use client';

import { useCallback, useState } from 'react';

import { ActivityChart } from '@/components/elections/analytics/charts/chart-activity';
import { DynamicsChart } from '@/components/elections/analytics/charts/chart-dynamics';
import { downloadChartAsPng } from '@/components/elections/analytics/charts/chart-export';
import { ShareChart } from '@/components/elections/analytics/charts/chart-share';
import { ChartWrapper } from '@/components/elections/analytics/charts/chart-wrapper';
import { Tabs } from '@/components/ui/tabs';
import { CHART_COLORS, GRANULARITY_LABEL } from '@/lib/analytics-compute';
import type {
  ActivityPoint,
  AnalyticsTimePoint,
  ChartGranularity,
  LegendEntry,
  SharePoint,
} from '@/types/analytics-charts';
import type { BallotsElection } from '@/types/ballot';
import type { ElectionChoice } from '@/types/election';
import type { AnalyticsMetrics } from '@/types/metrics';

type ChartTab = 'dynamics' | 'activity' | 'share';

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

  const granLabel = GRANULARITY_LABEL[granularity];

  const legendEntries: LegendEntry[] = (() => {
    if (
      (activeTab === 'dynamics' || activeTab === 'share') &&
      decryptionDone &&
      choices.length > 1
    ) {
      return choices.map((c, i) => ({
        color: CHART_COLORS[i % CHART_COLORS.length]!,
        label: c.choice,
      }));
    }
    return [];
  })();

  // Each tab's downloader closes over its own data and passes a `renderChart`
  // factory to `downloadChartAsPng`. The factory receives the exact export
  // pixel dimensions and returns the chart element rendered WITHOUT
  // ResponsiveContainer — this is what makes the export viewport-independent.
  const dynamicsDownloader = useCallback(
    () =>
      downloadChartAsPng(
        (w, h) => (
          <DynamicsChart
            data={timeSeries}
            choices={choices}
            decryptionDone={decryptionDone}
            exportSize={{ width: w, height: h }}
          />
        ),
        election,
        `Динаміка голосування · ${granLabel}`,
        legendEntries,
        'dynamics',
      ),
    [timeSeries, choices, decryptionDone, election, granLabel, legendEntries],
  );

  const activityDownloader = useCallback(
    () =>
      downloadChartAsPng(
        (w, h) => (
          <ActivityChart
            data={activityData}
            metrics={metrics}
            exportSize={{ width: w, height: h }}
          />
        ),
        election,
        `Активність голосування · ${granLabel}`,
        [],
        'activity',
      ),
    [activityData, metrics, election, granLabel],
  );

  const shareDownloader = useCallback(
    () =>
      downloadChartAsPng(
        (w, h) => (
          <ShareChart
            data={shareEvolution}
            choices={choices}
            exportSize={{ width: w, height: h }}
          />
        ),
        election,
        `Частка голосів · ${granLabel}`,
        legendEntries,
        'share',
      ),
    [shareEvolution, choices, election, granLabel, legendEntries],
  );

  return (
    <div className="space-y-4">
      {/* Tab header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-foreground text-lg font-semibold">Графіки</h2>
        <div className="w-full sm:w-auto sm:min-w-70">
          <Tabs tabs={tabs} activeTab={activeTab} onTabChange={(key) => setActiveTab(key)} />
        </div>
      </div>

      {activeTab === 'dynamics' && (
        <ChartWrapper
          title={`Динаміка надходження голосів · ${granLabel}`}
          onDownload={dynamicsDownloader}
          legend={legendEntries}
        >
          <DynamicsChart data={timeSeries} choices={choices} decryptionDone={decryptionDone} />
        </ChartWrapper>
      )}

      {activeTab === 'activity' && (
        <ChartWrapper
          title={`Активність голосування · ${granLabel}`}
          onDownload={activityDownloader}
        >
          <ActivityChart data={activityData} metrics={metrics} />
        </ChartWrapper>
      )}

      {activeTab === 'share' && decryptionDone && (
        <ChartWrapper
          title={`Еволюція частки голосів · ${granLabel}`}
          onDownload={shareDownloader}
          legend={legendEntries}
        >
          <ShareChart data={shareEvolution} choices={choices} />
        </ChartWrapper>
      )}
    </div>
  );
}
