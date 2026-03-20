'use client';

import { useEffect, useState } from 'react';

import { calculateVotePercentage, cn } from '@/lib/utils';
import type { TallyResult } from '@/types/tally';

const colors = [
  { bar: 'from-(--kpi-navy) to-(--kpi-blue-mid)', badge: 'bg-(--kpi-navy)' },
  {
    bar: 'from-(--kpi-orange) to-(--kpi-orange-dark)',
    badge: 'bg-(--kpi-orange)',
  },
  {
    bar: 'from-(--kpi-blue-light) to-(--kpi-blue-mid)',
    badge: 'bg-(--kpi-blue-light)',
  },
  { bar: 'from-(--kpi-wine) to-(--kpi-wine-deep)', badge: 'bg-(--kpi-wine)' },
  { bar: 'from-emerald-500 to-emerald-600', badge: 'bg-emerald-500' },
];

interface ResultsChartProps {
  results: TallyResult[];
  totalBallots: number;
}

export function ResultsChart({ results, totalBallots }: ResultsChartProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  let highestVotes = 0;
  const winners: Set<string> = new Set();

  for (const result of results) {
    if (result.votes > highestVotes) {
      highestVotes = result.votes;
      winners.clear();
      winners.add(result.choiceId);
    } else if (result.votes === highestVotes) {
      winners.add(result.choiceId);
    }
  }
  const winnerLabel = winners.size > 1 ? 'Нічия' : 'Переможець';

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {results.map((result, index) => {
          const pct = calculateVotePercentage(result.votes, totalBallots);
          const color = colors[index % colors.length]!;
          const isWinner = winners.has(result.choiceId);

          return (
            <div
              key={result.choiceId}
              className={cn(
                'rounded-lg border p-4 transition-all duration-300',
                isWinner
                  ? 'border-(--kpi-navy)/30 bg-(--kpi-navy)/3'
                  : 'border-(--border-subtle) bg-white',
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'font-body flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white',
                      color.badge,
                    )}
                  >
                    {String.fromCharCode(65 + result.position)}
                  </div>
                  <span
                    className={cn(
                      'font-body text-sm font-medium',
                      isWinner ? 'text-(--kpi-navy)' : 'text-(--foreground)',
                    )}
                  >
                    {result.choice}
                  </span>
                  {isWinner && totalBallots > 0 && (
                    <span className="rounded-full bg-(--kpi-orange) px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
                      {winnerLabel}
                    </span>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-display text-xl font-bold text-(--foreground)">
                    {animated ? pct : 0}%
                  </span>
                  <p className="font-body text-xs text-(--muted-foreground)">
                    {result.votes} {result.votes === 1 ? 'голос' : 'голосів'}
                  </p>
                </div>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-(--border-subtle)">
                <div
                  className={cn(
                    'h-full rounded-full bg-linear-to-r transition-all duration-1000 ease-out',
                    color.bar,
                  )}
                  style={{
                    width: animated ? `${pct}%` : '0%',
                    transitionDelay: `${index * 100}ms`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {totalBallots === 0 && (
        <p className="font-body py-4 text-center text-sm text-(--muted-foreground)">
          Поки що голосів немає
        </p>
      )}
    </div>
  );
}
