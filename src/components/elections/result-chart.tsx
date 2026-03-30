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
  { bar: 'from-violet-500 to-violet-700', badge: 'bg-violet-500', crown: 'text-violet-500' },
  { bar: 'from-rose-500 to-rose-600', badge: 'bg-rose-500', crown: 'text-rose-500' },
  { bar: 'from-amber-500 to-amber-600', badge: 'bg-amber-500', crown: 'text-amber-500' },
  { bar: 'from-teal-500 to-teal-700', badge: 'bg-teal-500', crown: 'text-teal-500' },
  { bar: 'from-indigo-500 to-indigo-700', badge: 'bg-indigo-500', crown: 'text-indigo-500' },
  { bar: 'from-cyan-500 to-cyan-600', badge: 'bg-cyan-500', crown: 'text-cyan-500' },
  { bar: 'from-pink-500 to-pink-600', badge: 'bg-pink-500', crown: 'text-pink-500' },
  {
    bar: 'from-kpi-blue-dark to-kpi-blue-deep',
    badge: 'bg-kpi-blue-dark',
    crown: 'text-kpi-blue-dark',
  },
  { bar: 'from-lime-500 to-lime-700', badge: 'bg-lime-500', crown: 'text-lime-500' },
  { bar: 'from-fuchsia-500 to-fuchsia-700', badge: 'bg-fuchsia-500', crown: 'text-fuchsia-500' },
  { bar: 'from-sky-500 to-sky-700', badge: 'bg-sky-500', crown: 'text-sky-500' },
];

const CONFETTI_KEY_PREFIX = 'election_confetti_shown_';

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
      setUserChoices(localRecord.choiceIds);
    }

    return () => clearTimeout(t);
  }, [electionId, hideOwnVote]);

  useEffect(() => {
    if (userChoices.length === 0 || hideOwnVote || totalBallots === 0) return;

    const triggerConfetti = async () => {
      try {
        const confettiKey = `${CONFETTI_KEY_PREFIX}${electionId}`;
        if (localStorage.getItem(confettiKey)) return;

        const highestVotes = Math.max(...results.map((r) => r.votes));
        const winnerIds = new Set(
          results.filter((r) => r.votes === highestVotes).map((r) => r.choiceId),
        );
        const userWon = userChoices.some((id) => winnerIds.has(id));

        if (userWon) {
          const { default: confetti } = await import('@hiseb/confetti');
          confetti({ count: 200, size: 1 });
          localStorage.setItem(confettiKey, '1');
        }
      } catch (error) {
        console.error('Confetti failed to load', error);
      }
    };

    triggerConfetti();
  }, [userChoices, results, electionId, hideOwnVote, totalBallots]);

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
