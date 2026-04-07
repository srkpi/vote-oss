'use client';

import {
  Activity,
  BarChart2,
  Clock,
  GitBranch,
  Scale,
  Target,
  TrendingUp,
  Unlock,
  Zap,
} from 'lucide-react';
import { useMemo } from 'react';

import {
  AnalyticsMetricsGrid,
  type MetricCardConfig,
} from '@/components/elections/analytics/analytics-metric-cart';
import { Button } from '@/components/ui/button';
import { computeAnalytics } from '@/lib/analytics-compute';
import type { Ballot, DecryptedMap } from '@/types/ballot';
import type { BallotsElection } from '@/types/ballot';
import type { ElectionChoice } from '@/types/election';

import { AnalyticsCharts } from './analytics-charts';
import { AnalyticsCsvPanel } from './analytics-csv-panel';

interface AnalyticsPanelProps {
  ballots: Ballot[];
  decryptedMap: DecryptedMap;
  decryptionDone: boolean;
  isDecrypting: boolean;
  onDecrypt: () => void;
  choices: ElectionChoice[];
  election: BallotsElection;
}

function buildMetrics(
  ballots: Ballot[],
  decryptedMap: DecryptedMap,
  choices: ElectionChoice[],
  decryptionDone: boolean,
): MetricCardConfig[] {
  const { metrics } = computeAnalytics(ballots, decryptedMap, choices, decryptionDone);
  const { totalBallots } = metrics;
  const result: MetricCardConfig[] = [];

  // ── Peak activity concentration ────────────────────────────
  if (totalBallots >= 1 && metrics.peakHourConcentration !== null) {
    const pct = metrics.peakHourConcentration;
    result.push({
      id: 'peak',
      icon: <Activity className="h-4 w-4" />,
      label: 'Пікова активність',
      value: `${pct.toFixed(1)}%`,
      color: pct > 50 ? 'orange' : pct > 25 ? 'warning' : 'success',
      interpretation:
        pct > 50
          ? `Понад половина голосів надійшла в одному проміжку`
          : pct > 25
            ? `Виражений пік активності — ${metrics.peakHourLabel}`
            : `Рівномірна активність протягом усього голосування`,
      description:
        'Показує, яка частина від усіх голосів надійшла в найактивніший часовий проміжок. Висока концентрація може вказувати на масове нагадування учасникам або на те, що більшість проголосувала одразу після відкриття.',
      insight:
        pct > 50
          ? `Пік прийшовся на ${metrics.peakHourLabel ?? 'один проміжок'} — ${pct.toFixed(1)}% усіх голосів. Решта розподілилась рівномірніше.`
          : `Найактивніший проміжок — ${metrics.peakHourLabel ?? '—'} (${pct.toFixed(1)}%). Активність розподілена відносно рівномірно.`,
      scale: {
        min: 0,
        max: 100,
        current: pct,
        gradientFrom: '#16a34a',
        gradientTo: '#f07d00',
        labels: ['Рівномірно', 'Один сплеск'],
      },
    });
  }

  if (totalBallots >= 4 && metrics.velocityRatio !== null) {
    const vr = metrics.velocityRatio;
    const isAccel = vr > 1.25;
    const isSlowing = vr < 0.75;
    result.push({
      id: 'velocity',
      icon: <Zap className="h-4 w-4" />,
      label: 'Тренд голосування',
      value: `${vr.toFixed(2)}×`,
      color: isAccel ? 'success' : isSlowing ? 'warning' : 'blue',
      interpretation: isAccel
        ? 'Прискорення до кінця — активність зростала'
        : isSlowing
          ? 'Сповільнення — більшість проголосувала на початку'
          : 'Стабільний рівномірний темп протягом голосування',
      description:
        'Порівнює швидкість надходження голосів у другій половині голосування з першою. Значення більше 1 означає прискорення, менше 1 — сповільнення. Допомагає зрозуміти, чи була мобілізація учасників під кінець.',
      insight: isAccel
        ? `Темп голосування у другій половині був у ${vr.toFixed(1)} рази вищим — помітна мобілізація ближче до закриття.`
        : isSlowing
          ? `Більшість учасників проголосувала на початку. Активність у другій половині склала ${(vr * 100).toFixed(0)}% від початкової.`
          : `Голосування відбувалось рівномірно — різниці між першою і другою половиною майже немає.`,
      scale: {
        min: 0,
        max: 2.5,
        current: Math.min(vr, 2.5),
        gradientFrom: '#f59e0b',
        gradientTo: '#10b981',
        labels: ['Сповільнення', 'Прискорення'],
      },
    });
  }

  if (totalBallots >= 2 && metrics.medianTimePercentile !== null) {
    const mp = metrics.medianTimePercentile;
    const isEarly = mp < 35;
    const isLate = mp > 65;
    result.push({
      id: 'median',
      icon: <Clock className="h-4 w-4" />,
      label: 'Хвиля голосування',
      value: `${mp.toFixed(0)}%`,
      color: 'navy',
      interpretation: isEarly
        ? 'Рання хвиля — більшість проголосувала на початку'
        : isLate
          ? 'Пізня хвиля — більшість зібралась наприкінці'
          : 'Рівномірна участь протягом усього часу',
      description:
        'Показує, в якій точці часу голосування надійшла рівно половина всіх бюлетенів. Наприклад, 30% означає, що половина голосів зібрана за першу третину часу — типова "рання хвиля".',
      insight: isEarly
        ? `Половина голосів надійшла вже на ${mp.toFixed(0)}% тривалості — учасники активно реагували з самого початку.`
        : isLate
          ? `Половина голосів зібрана лише на ${mp.toFixed(0)}% часу — активність зростала поступово й пришвидшилась наприкінці.`
          : `Голоси розподілились рівномірно протягом усього голосування — медіана на ${mp.toFixed(0)}% тривалості.`,
      scale: {
        min: 0,
        max: 100,
        current: mp,
        gradientFrom: '#008acf',
        gradientTo: '#1c396e',
        labels: ['На початку', 'Наприкінці'],
      },
    });
  }

  if (decryptionDone && choices.length >= 2) {
    // Entropy
    if (metrics.normalizedEntropy !== null) {
      const ent = metrics.normalizedEntropy * 100;
      result.push({
        id: 'entropy',
        icon: <Scale className="h-4 w-4" />,
        label: 'Конкурентність виборів',
        value: `${ent.toFixed(1)}%`,
        color: ent > 70 ? 'success' : ent > 40 ? 'blue' : 'orange',
        interpretation:
          ent > 70
            ? 'Висока конкурентність — голоси розподілені рівномірно'
            : ent > 40
              ? 'Помірна конкурентність між варіантами'
              : 'Явний фаворит — більшість голосів за одного',
        description:
          'Показує, наскільки рівно розподілені голоси між усіма варіантами. 100% — кожен варіант отримав однаково; 0% — весь результат зосереджений на одному варіанті. Чим вище значення — тим більш непередбачуваним і конкурентним є голосування.',
        insight:
          ent > 70
            ? `Голоси розподілені майже рівно між усіма ${choices.length} варіантами — результат справді відкритий.`
            : ent > 40
              ? `Помірна рівність: є лідер, але конкуренти також набирають значну частку.`
              : `Результат сконцентрований на одному-двох варіантах. Більшість обрала одне.`,
        scale: {
          min: 0,
          max: 100,
          current: ent,
          gradientFrom: '#f07d00',
          gradientTo: '#10b981',
          labels: ['Один лідер', 'Всі рівні'],
        },
      });
    }

    // ENC
    if (metrics.enc !== null) {
      const enc = metrics.enc;
      result.push({
        id: 'enc',
        icon: <GitBranch className="h-4 w-4" />,
        label: 'Реальних претендентів',
        value: enc.toFixed(1),
        color: 'purple',
        interpretation:
          enc <= 1.5
            ? 'Фактично один варіант домінує'
            : enc <= 2.5
              ? 'Конкуренція двох лідерів'
              : `Реальна боротьба ${Math.round(enc)} варіантів`,
        description:
          'Вказує, скільки варіантів реально конкурують між собою, незважаючи на загальну кількість варіантів. Якщо двоє набирають 90% голосів, а решта — по відсотку, то реальних претендентів двоє.',
        insight:
          enc <= 1.5
            ? `Попри ${choices.length} варіантів у бюлетені, по суті голосування зводиться до одного явного фаворита.`
            : enc <= 2.5
              ? `Класична дуель: два варіанти збирають більшість голосів.`
              : `${enc.toFixed(1)} рівноцінних варіантів реально борються за голоси — широкий вибір.`,
        scale: {
          min: 1,
          max: choices.length,
          current: enc,
          gradientFrom: '#8b5cf6',
          gradientTo: '#10b981',
          labels: ['Монополія', 'Рівна боротьба'],
        },
      });
    }

    // Gini
    if (metrics.gini !== null) {
      const g = metrics.gini * 100;
      result.push({
        id: 'gini',
        icon: <Scale className="h-4 w-4" />,
        label: 'Нерівність розподілу',
        value: `${g.toFixed(1)}%`,
        color: g > 50 ? 'error' : g > 25 ? 'warning' : 'success',
        interpretation:
          g > 50
            ? 'Висока нерівність — голоси сильно скупчені'
            : g > 25
              ? 'Помірна нерівність між варіантами'
              : 'Голоси розподілені відносно рівно',
        description:
          'Запозичений з економіки показник нерівності. 0% — всі варіанти отримали однаково; 100% — один варіант забрав усе. Допомагає зрозуміти, чи є реальна боротьба між варіантами.',
        insight:
          g > 50
            ? `Нерівність висока: голоси нерівномірно скупчені. Переможець має суттєву перевагу.`
            : g > 25
              ? `Є помітний лідер, але інші варіанти також набирають вагому частку.`
              : `Голоси розподілені порівняно рівно — жоден варіант не домінує безперечно.`,
        scale: {
          min: 0,
          max: 100,
          current: g,
          gradientFrom: '#10b981',
          gradientTo: '#dc2626',
          labels: ['Рівно', 'Сконцентровано'],
        },
      });
    }

    // Leading margin
    if (metrics.leadingMargin !== null) {
      const lm = metrics.leadingMargin;
      result.push({
        id: 'margin',
        icon: <Target className="h-4 w-4" />,
        label: 'Відрив лідера',
        value: `${lm.toFixed(1)}%`,
        color: lm < 5 ? 'warning' : lm < 20 ? 'blue' : 'navy',
        interpretation:
          lm < 5
            ? 'Практично рівний результат — напружена боротьба'
            : lm < 20
              ? 'Помірна перевага лідера над конкурентом'
              : 'Переконлива перемога — значний відрив',
        description:
          'Різниця у відсотках між першим і другим місцем. Чим менший відрив, тим більш непередбачуваним є результат і тим більш вирішальним є кожен голос.',
        insight:
          lm < 5
            ? `Відрив між 1-м і 2-м місцем — лише ${lm.toFixed(1)}%. Вирішальним може бути буквально кожен голос.`
            : lm < 20
              ? `Лідер випереджає суперника на ${lm.toFixed(1)}% — помітна, але не нищівна перевага.`
              : `Впевнена перемога з відривом ${lm.toFixed(1)}% від найближчого суперника.`,
        scale: {
          min: 0,
          max: 60,
          current: Math.min(lm, 60),
          gradientFrom: '#f07d00',
          gradientTo: '#1c396e',
          labels: ['Нічия', 'Одноосібно'],
        },
      });
    }

    // Frontrunner changes
    if (metrics.frontrunnerChanges !== null) {
      const fc = metrics.frontrunnerChanges;
      result.push({
        id: 'frontrunner',
        icon: <TrendingUp className="h-4 w-4" />,
        label: 'Зміни лідера',
        value: String(fc),
        color: fc > 3 ? 'error' : fc > 0 ? 'orange' : 'success',
        interpretation:
          fc === 0
            ? 'Лідер не змінювався — стабільний та передбачуваний результат'
            : fc <= 2
              ? `${fc} ${fc === 1 ? 'зміна лідера' : 'зміни лідера'} — невелика волатильність`
              : `${fc} змін лідера — напружена боротьба протягом усього голосування`,
        description:
          'Рахує, скільки разів перше місце переходило від одного варіанта до іншого в процесі надходження голосів. Показує, наскільки динамічним і непередбачуваним було голосування.',
        insight:
          fc === 0
            ? 'Один і той самий варіант лідирував від початку до кінця — результат визначився рано.'
            : fc <= 2
              ? `Лідерство змінювалось ${fc} ${fc === 1 ? 'раз' : 'рази'} — лише невелике коливання.`
              : `Лідер змінювався ${fc} разів — результат залишався непередбачуваним до самого кінця.`,
      });
    }
  }

  return result;
}

function DecryptBanner({
  isDecrypting,
  onDecrypt,
}: {
  isDecrypting: boolean;
  onDecrypt: () => void;
}) {
  return (
    <div className="border-kpi-orange/25 rounded-xl border bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-3.5">
          <div className="bg-kpi-orange/15 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
            <Unlock className="text-kpi-orange h-5 w-5" />
          </div>
          <div>
            <p className="font-body text-foreground text-sm font-semibold">
              Розшифруйте бюлетені для повної аналітики
            </p>
            <p className="font-body text-muted-foreground mt-0.5 text-xs leading-snug">
              Часова аналітика вже доступна. Після дешифрування з&apos;являться ще 5 показників та
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

function EmptyState() {
  return (
    <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-14 text-center">
      <div className="bg-surface border-border-subtle mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border">
        <BarChart2 className="text-kpi-gray-mid h-7 w-7" />
      </div>
      <p className="font-display text-foreground text-lg font-semibold">Немає даних для аналізу</p>
      <p className="font-body text-muted-foreground mt-1 text-sm">Жодного бюлетеня ще не подано</p>
    </div>
  );
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

  if (ballots.length === 0) return <EmptyState />;

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
            {visibleMetrics.length > 0 && (
              <p className="text-muted-foreground text-xs">Натисніть на картку для деталей</p>
            )}
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
