'use client';

import { useState, useEffect } from 'react';
import { cn, calculateVotePercentage } from '@/lib/utils';
import type { TallyResult } from '@/types';

interface ResultsChartProps {
  results: TallyResult[];
  totalBallots: number;
  loading?: boolean;
}

export function ResultsChart({ results, totalBallots, loading }: ResultsChartProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return <ResultsChartSkeleton />;
  }

  const sorted = [...results].sort((a, b) => b.votes - a.votes);
  const winner = sorted[0];

  const colors = [
    { bar: 'from-[var(--kpi-navy)] to-[var(--kpi-blue-mid)]', badge: 'bg-[var(--kpi-navy)]' },
    {
      bar: 'from-[var(--kpi-orange)] to-[var(--kpi-orange-dark)]',
      badge: 'bg-[var(--kpi-orange)]',
    },
    {
      bar: 'from-[var(--kpi-blue-light)] to-[var(--kpi-blue-mid)]',
      badge: 'bg-[var(--kpi-blue-light)]',
    },
    { bar: 'from-[var(--kpi-wine)] to-[var(--kpi-wine-deep)]', badge: 'bg-[var(--kpi-wine)]' },
    { bar: 'from-emerald-500 to-emerald-600', badge: 'bg-emerald-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Results */}
      <div className="space-y-4">
        {sorted.map((result, index) => {
          const pct = calculateVotePercentage(result.votes, totalBallots);
          const color = colors[index % colors.length]!;
          const isWinner = result.choiceId === winner?.choiceId && totalBallots > 0;

          return (
            <div
              key={result.choiceId}
              className={cn(
                'p-4 rounded-[var(--radius-lg)] border transition-all duration-300',
                isWinner
                  ? 'border-[var(--kpi-navy)]/30 bg-[var(--kpi-navy)]/3'
                  : 'border-[var(--border-subtle)] bg-white',
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold font-body shrink-0',
                      color.badge,
                    )}
                  >
                    {String.fromCharCode(65 + result.position)}
                  </div>
                  <span
                    className={cn(
                      'font-body text-sm font-medium',
                      isWinner ? 'text-[var(--kpi-navy)]' : 'text-[var(--foreground)]',
                    )}
                  >
                    {result.choice}
                  </span>
                  {isWinner && totalBallots > 0 && (
                    <span className="text-[10px] font-semibold text-white bg-[var(--kpi-orange)] px-2 py-0.5 rounded-full uppercase tracking-wide">
                      Лідер
                    </span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="font-display text-xl font-bold text-[var(--foreground)]">
                    {animated ? pct : 0}%
                  </span>
                  <p className="text-xs text-[var(--muted-foreground)] font-body">
                    {result.votes} {result.votes === 1 ? 'голос' : 'голосів'}
                  </p>
                </div>
              </div>

              <div className="h-2 w-full rounded-full bg-[var(--border-subtle)] overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full bg-gradient-to-r transition-all ease-out duration-1000',
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
        <p className="text-center text-sm text-[var(--muted-foreground)] font-body py-4">
          Поки що голосів немає
        </p>
      )}
    </div>
  );
}

function ResultsChartSkeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-16 rounded-[var(--radius-lg)]" />
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="p-4 rounded-[var(--radius-lg)] border border-[var(--border-subtle)]"
        >
          <div className="flex justify-between mb-3">
            <div className="skeleton h-4 w-40 rounded" />
            <div className="skeleton h-6 w-12 rounded" />
          </div>
          <div className="skeleton h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}
