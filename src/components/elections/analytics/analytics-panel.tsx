'use client';

import { BarChart2, Unlock } from 'lucide-react';
import { useMemo } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { AnalyticsCsvPanel } from '@/components/elections/analytics/analytics-csv-panel';
import { AnalyticsMetricsGrid } from '@/components/elections/analytics/analytics-metric-cart';
import { AnalyticsCharts } from '@/components/elections/analytics/charts/analytics-charts';
import { buildEncMetric } from '@/components/elections/analytics/metrics/enc';
import { buildEntropyMetric } from '@/components/elections/analytics/metrics/entropy';
import { buildFrontrunnerMetric } from '@/components/elections/analytics/metrics/frontrunner';
import { buildGiniMetric } from '@/components/elections/analytics/metrics/gini';
import { buildMarginMetric } from '@/components/elections/analytics/metrics/margin';
import { buildMedianMetric } from '@/components/elections/analytics/metrics/median';
import { buildPeakMetric } from '@/components/elections/analytics/metrics/peak';
import { buildVelocityMetric } from '@/components/elections/analytics/metrics/velocity';
import { Button } from '@/components/ui/button';
import { computeAnalytics } from '@/lib/analytics-compute';
import type { Ballot, BallotsElection, DecryptedMap } from '@/types/ballot';
import type { ElectionChoice } from '@/types/election';
import type { MetricCardConfig, MetricContext } from '@/types/metrics';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalyticsPanelProps {
  ballots: Ballot[];
  decryptedMap: DecryptedMap;
  decryptionDone: boolean;
  isDecrypting: boolean;
  onDecrypt: () => void;
  choices: ElectionChoice[];
  election: BallotsElection;
}

// ── Metric pipeline ───────────────────────────────────────────────────────────

/**
 * Runs every metric builder in order and filters out nulls.
 * Builders decide independently whether they have enough data to render.
 */
function buildMetrics(
  ballots: Ballot[],
  decryptedMap: DecryptedMap,
  choices: ElectionChoice[],
  decryptionDone: boolean,
): MetricCardConfig[] {
  const { metrics } = computeAnalytics(ballots, decryptedMap, choices, decryptionDone);

  const ctx: MetricContext = {
    ballots,
    decryptedMap,
    decryptionDone,
    choices,
    metrics,
    totalBallots: metrics.totalBallots,
    choiceCount: choices.length,
  };

  const builders = [
    buildPeakMetric,
    buildVelocityMetric,
    buildMedianMetric,
    buildEntropyMetric,
    buildEncMetric,
    buildGiniMetric,
    buildMarginMetric,
    buildFrontrunnerMetric,
  ];

  return builders.flatMap((build) => {
    const result = build(ctx);
    return result ? [result] : [];
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DecryptBanner({
  isDecrypting,
  onDecrypt,
}: {
  isDecrypting: boolean;
  onDecrypt: () => void;
}) {
  return (
    <div className="border-kpi-orange/30 rounded-xl border bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="bg-kpi-orange/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <Unlock className="text-kpi-orange h-5 w-5" />
          </div>
          <div>
            <p className="font-body text-foreground text-sm font-semibold">
              Розшифруйте бюлетені для повної аналітики
            </p>
            <p className="font-body text-muted-foreground mt-0.5 text-xs leading-snug">
              Часова аналітика вже доступна. Після дешифрування з&apos;явиться більше показників та
              розподілу часток.
            </p>
          </div>
        </div>
        <Button
          variant="accent"
          size="sm"
          onClick={onDecrypt}
          loading={isDecrypting}
          disabled={isDecrypting}
          icon={<Unlock className="h-3.5 w-3.5" />}
        >
          {isDecrypting ? 'Розшифровуємо…' : 'Розшифрувати'}
        </Button>
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-foreground text-lg font-semibold">{children}</h2>;
}

export function AnalyticsPanel({
  ballots,
  decryptedMap,
  decryptionDone,
  isDecrypting,
  onDecrypt,
  choices,
  election,
}: AnalyticsPanelProps) {
  const analyticsResult = useMemo(
    () => computeAnalytics(ballots, decryptedMap, choices, decryptionDone),
    [ballots, decryptedMap, choices, decryptionDone],
  );

  const visibleMetrics = useMemo(
    () => buildMetrics(ballots, decryptedMap, choices, decryptionDone),
    [ballots, decryptedMap, choices, decryptionDone],
  );

  if (ballots.length === 0) {
    return (
      <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-12 text-center">
        <EmptyState
          title="Немає даних для аналізу"
          description="Жодного бюлетеня ще не подано"
          icon={<BarChart2 className="text-kpi-gray-mid h-7 w-7" />}
        />
      </div>
    );
  }

  const { timeSeries, activityData, shareEvolution, granularity, metrics } = analyticsResult;

  return (
    <div className="space-y-8">
      {!decryptionDone && !!election.privateKey && election.ballotCount > 0 && (
        <DecryptBanner isDecrypting={isDecrypting} onDecrypt={onDecrypt} />
      )}

      {visibleMetrics.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <SectionHeader>Аналітичні показники</SectionHeader>
            <p className="text-muted-foreground hidden text-xs sm:inline">
              Натисніть на картку для деталей
            </p>
          </div>
          <AnalyticsMetricsGrid metrics={visibleMetrics} />
        </section>
      )}

      <AnalyticsCharts
        timeSeries={timeSeries}
        activityData={activityData}
        shareEvolution={shareEvolution}
        granularity={granularity}
        metrics={metrics}
        choices={choices}
        election={election}
        decryptionDone={decryptionDone}
      />

      <AnalyticsCsvPanel
        ballots={ballots}
        decryptedMap={decryptedMap}
        decryptionDone={decryptionDone}
        electionId={election.id}
      />
    </div>
  );
}
