'use client';

import { useState } from 'react';

import { ActivityChart } from '@/components/elections/analytics/charts/chart-activity';
import { DynamicsChart } from '@/components/elections/analytics/charts/chart-dynamics';
import { downloadChartAsPng } from '@/components/elections/analytics/charts/chart-export';
import { ShareChart } from '@/components/elections/analytics/charts/chart-share';
import { ChartWrapper } from '@/components/elections/analytics/charts/chart-wrapper';
import { Tabs } from '@/components/ui/tabs';
import { useTheme } from '@/hooks/use-theme';
import { getChartTheme, GRANULARITY_LABEL } from '@/lib/analytics-compute';
import type {
  ActivityPoint,
  AnalyticsTimePoint,
  ChartGranularity,
  LegendEntry,
  SharePoint,
} from '@/types/analytics-charts';
import type { BallotsElection } from '@/types/ballot';
import type { AnalyticsMetrics } from '@/types/metrics';

type ChartTab = 'dynamics' | 'activity' | 'share';

interface ChartsProps {
  timeSeries: AnalyticsTimePoint[];
  activityData: ActivityPoint[];
  shareEvolution: SharePoint[];
  granularity: ChartGranularity;
  metrics: AnalyticsMetrics;
  election: BallotsElection;
  decryptionDone: boolean;
}

export function AnalyticsCharts({
  timeSeries,
  activityData,
  shareEvolution,
  granularity,
  metrics,
  election,
  decryptionDone,
}: ChartsProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>('dynamics');
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const tabs = [
    { key: 'dynamics' as const, label: 'Динаміка' },
    { key: 'activity' as const, label: 'Активність' },
    ...(decryptionDone && election.choices.length > 1
      ? [{ key: 'share' as const, label: 'Частка' }]
      : []),
  ];

  const granLabel = GRANULARITY_LABEL[granularity];

  const buildLegendEntries = (forDark: boolean): LegendEntry[] => {
    if (
      (activeTab === 'dynamics' || activeTab === 'share') &&
      decryptionDone &&
      election.choices.length > 1
    ) {
      const colors = getChartTheme(forDark).seriesColors;
      return election.choices.map((c, i) => ({
        color: colors[i % colors.length]!,
        label: c.choice,
      }));
    }
    return [];
  };

  // On-screen legend follows the active site theme; PNG exports always use
  // the light palette, since `chart-export.tsx` draws its legend onto a
  // fixed, always-light branded canvas.
  const legendEntries = buildLegendEntries(isDark);
  const exportLegendEntries = buildLegendEntries(false);

  // Each tab's downloader closes over its own data and passes a `renderChart`
  // factory to `downloadChartAsPng`. The factory receives the exact export
  // pixel dimensions and returns the chart element rendered WITHOUT
  // ResponsiveContainer — this is what makes the export viewport-independent.
  const dynamicsDownloader = () =>
    downloadChartAsPng(
      (w, h) => (
        <DynamicsChart
          data={timeSeries}
          choices={election.choices}
          decryptionDone={decryptionDone}
          exportSize={{ width: w, height: h }}
          opensAt={election.opensAt}
          closesAt={election.closesAt}
        />
      ),
      election,
      election.type === 'ELECTION'
        ? `Динаміка голосування · ${granLabel}`
        : `Динаміка підписів · ${granLabel}`,
      exportLegendEntries,
      'dynamics',
    );

  const activityDownloader = () =>
    downloadChartAsPng(
      (w, h) => (
        <ActivityChart data={activityData} metrics={metrics} exportSize={{ width: w, height: h }} />
      ),
      election,
      election.type === 'ELECTION'
        ? `Активність голосування · ${granLabel}`
        : `Активність збору підписів · ${granLabel}`,
      [],
      'activity',
    );

  const shareDownloader = () =>
    downloadChartAsPng(
      (w, h) => (
        <ShareChart
          data={shareEvolution}
          choices={election.choices}
          exportSize={{ width: w, height: h }}
          isMultiChoice={election.maxChoices > 1}
        />
      ),
      election,
      `Частка голосів · ${granLabel}`,
      legendEntries,
      'share',
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
          title={
            election.type === 'ELECTION'
              ? 'Динаміка надходження голосів'
              : 'Динаміка збору підписів'
          }
          onDownload={dynamicsDownloader}
          legend={legendEntries}
        >
          <DynamicsChart
            data={timeSeries}
            choices={election.choices}
            decryptionDone={decryptionDone}
            opensAt={election.opensAt}
            closesAt={election.closesAt}
            darkMode={theme === 'dark'}
          />
        </ChartWrapper>
      )}

      {activeTab === 'activity' && (
        <ChartWrapper
          title={
            election.type === 'ELECTION' ? 'Активність голосування' : 'Активність збору підписів'
          }
          onDownload={activityDownloader}
        >
          <ActivityChart data={activityData} metrics={metrics} darkMode={theme === 'dark'} />
        </ChartWrapper>
      )}

      {activeTab === 'share' && decryptionDone && (
        <ChartWrapper
          title="Еволюція частки голосів"
          onDownload={shareDownloader}
          legend={legendEntries}
        >
          <ShareChart
            data={shareEvolution}
            choices={election.choices}
            isMultiChoice={election.maxChoices > 1}
            darkMode={theme === 'dark'}
          />
        </ChartWrapper>
      )}
    </div>
  );
}
