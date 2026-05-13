import { AnimatedCounter } from '@/components/ui/animated-counter';
import { pluralize } from '@/lib/utils/common';
import type { PlatformStats } from '@/types/stats';

interface StatMetric {
  key: keyof Pick<PlatformStats, 'ballots' | 'elections' | 'petitions'>;
  label: [string, string, string];
}

const METRICS: StatMetric[] = [
  { key: 'ballots', label: ['Бюлетень', 'Бюлетені', 'Бюлетенів'] },
  { key: 'elections', label: ['Голосування', 'Голосування', 'Голосувань'] },
  { key: 'petitions', label: ['Петиція', 'Петиції', 'Петицій'] },
];

interface PlatformStatsSectionProps {
  stats: PlatformStats;
}

export function PlatformStatsSection({ stats }: PlatformStatsSectionProps) {
  return (
    <section className="my-20 grid grid-cols-3 gap-0">
      {METRICS.map(({ key, label }, index) => (
        <div key={key} className="relative flex flex-col items-center gap-3 text-center">
          {index > 0 && (
            <span
              aria-hidden
              className="border-border absolute top-3 -left-px hidden h-16 border-l md:block"
            />
          )}

          <p className="font-display text-kpi-navy text-4xl font-bold tracking-tight tabular-nums sm:text-5xl lg:text-6xl">
            <AnimatedCounter target={stats[key]} delay={index * 120} />
          </p>

          <p className="font-body text-muted-foreground max-w-36 text-xs font-semibold tracking-widest uppercase">
            {pluralize(stats[key], label, false)}
          </p>
        </div>
      ))}
    </section>
  );
}
