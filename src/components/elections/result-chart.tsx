'use client';

import { Crown } from 'lucide-react';
import { useEffect, useState } from 'react';

import { calculateVotePercentage, cn, pluralize } from '@/lib/utils';
import { getVote } from '@/lib/vote-storage';
import type { TallyResult } from '@/types/election';

const colors = [
  { bar: 'from-kpi-navy to-kpi-blue-mid', badge: 'bg-kpi-navy', crown: 'text-kpi-navy' },
  { bar: 'from-kpi-orange to-kpi-orange-dark', badge: 'bg-kpi-orange', crown: 'text-kpi-orange' },
  {
    bar: 'from-kpi-blue-light to-kpi-blue-mid',
    badge: 'bg-kpi-blue-light',
    crown: 'text-kpi-blue-light',
  },
  { bar: 'from-kpi-wine to-kpi-wine-deep', badge: 'bg-kpi-wine', crown: 'text-kpi-wine' },
  { bar: 'from-emerald-500 to-emerald-600', badge: 'bg-emerald-500', crown: 'text-emerald-500' },
];

interface ResultsChartProps {
  results: TallyResult[];
  totalBallots: number;
  electionId: string;
  hideOwnVote?: boolean;
}

export function ResultsChart({
  results,
  totalBallots,
  electionId,
  hideOwnVote,
}: ResultsChartProps) {
  const [animated, setAnimated] = useState(false);
  const [userChoices, setUserChoices] = useState<string[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);

    const localRecord = getVote(electionId);
    if (localRecord && localRecord.choiceIds && !hideOwnVote) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUserChoices(localRecord.choiceIds);
    }

    return () => clearTimeout(t);
  }, [electionId, hideOwnVote]);

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

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {results.map((result, index) => {
          const pct = calculateVotePercentage(result.votes, totalBallots);
          const color = colors[index % colors.length]!;
          const isWinner = winners.has(result.choiceId);
          const isUserChoice = userChoices.includes(result.choiceId);

          return (
            <div
              key={result.choiceId}
              className={cn(
                'rounded-lg border p-4 transition-all duration-300',
                isWinner ? 'border-kpi-navy/30 bg-kpi-navy/3' : 'border-border-subtle bg-white',
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  {isWinner && totalBallots > 0 && (
                    <Crown className={cn('h-4 w-4 shrink-0', color.crown)} />
                  )}

                  <span
                    className={cn(
                      'font-body text-sm font-medium',
                      isWinner ? 'text-kpi-navy' : 'text-foreground',
                    )}
                  >
                    {result.choice}
                  </span>

                  {isUserChoice && (
                    <span className="bg-success/15 text-success rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                      Ваш вибір
                    </span>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-display text-foreground text-xl font-bold">
                    {animated ? pct : 0}%
                  </span>
                  <p className="font-body text-muted-foreground text-xs">
                    {pluralize(result.votes, ['голос', 'голоси', 'голосів'])}
                  </p>
                </div>
              </div>

              <div className="bg-border-subtle h-2 w-full overflow-hidden rounded-full">
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
    </div>
  );
}
