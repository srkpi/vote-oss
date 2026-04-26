'use client';

import { Crown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { calculateVotePercentage, cn, pluralize } from '@/lib/utils/common';
import { getVote } from '@/lib/vote-storage';
import type { ElectionChoice } from '@/types/election';

import type { ChoiceSortOrder } from './sort-choices-button';

const colors = [
  { bar: 'from-kpi-navy to-kpi-blue-mid', crown: 'text-kpi-navy' },
  { bar: 'from-kpi-orange to-kpi-orange-dark', crown: 'text-kpi-orange' },
  { bar: 'from-kpi-blue-light to-kpi-blue-mid', crown: 'text-kpi-blue-light' },
  { bar: 'from-kpi-wine to-kpi-wine-deep', crown: 'text-kpi-wine' },
  { bar: 'from-emerald-500 to-emerald-600', crown: 'text-emerald-500' },
  { bar: 'from-violet-500 to-violet-700', crown: 'text-violet-500' },
  { bar: 'from-rose-500 to-rose-600', crown: 'text-rose-500' },
  { bar: 'from-amber-500 to-amber-600', crown: 'text-amber-500' },
  { bar: 'from-teal-500 to-teal-700', crown: 'text-teal-500' },
  { bar: 'from-indigo-500 to-indigo-700', crown: 'text-indigo-500' },
  { bar: 'from-cyan-500 to-cyan-600', crown: 'text-cyan-500' },
  { bar: 'from-pink-500 to-pink-600', crown: 'text-pink-500' },
  { bar: 'from-kpi-blue-dark to-kpi-blue-deep', crown: 'text-kpi-blue-dark' },
  { bar: 'from-lime-500 to-lime-700', crown: 'text-lime-500' },
  { bar: 'from-fuchsia-500 to-fuchsia-700', crown: 'text-fuchsia-500' },
  { bar: 'from-sky-500 to-sky-700', crown: 'text-sky-500' },
];

const CONFETTI_KEY_PREFIX = 'election_confetti_shown_';

interface ResultsChartProps {
  choices: ElectionChoice[];
  totalBallots: number;
  electionId: string;
  hideOwnVote?: boolean;
  sortOrder: ChoiceSortOrder;
}

export function ResultsChart({
  choices,
  totalBallots,
  electionId,
  hideOwnVote,
  sortOrder,
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

  useEffect(() => {
    if (userChoices.length === 0 || hideOwnVote || totalBallots === 0) return;

    const triggerConfetti = async () => {
      try {
        const confettiKey = `${CONFETTI_KEY_PREFIX}${electionId}`;
        if (localStorage.getItem(confettiKey)) return;

        const userWon = userChoices.some((id) => {
          const c = choices.find((c) => c.id === id);
          return c?.winner === true;
        });

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
  }, [userChoices, choices, electionId, hideOwnVote, totalBallots]);

  // Preserve original index for stable colors and animation delays regardless of sort.
  const sortedChoices = useMemo(() => {
    const indexed = choices.map((choice, originalIndex) => ({ choice, originalIndex }));
    if (sortOrder === 'votes') {
      return [...indexed].sort((a, b) => (b.choice.votes ?? 0) - (a.choice.votes ?? 0));
    }
    if (sortOrder === 'alpha') {
      return [...indexed].sort((a, b) => a.choice.choice.localeCompare(b.choice.choice, 'uk'));
    }
    return indexed;
  }, [choices, sortOrder]);

  return (
    <div className="space-y-4">
      {sortedChoices.map(({ choice, originalIndex }) => {
        const votes = choice.votes ?? 0;
        const pct = calculateVotePercentage(votes, totalBallots);
        const color = colors[originalIndex % colors.length]!;
        const isWinner = choice.winner === true;
        const isUserChoice = userChoices.includes(choice.id);

        return (
          <div
            key={choice.id}
            className={cn(
              'rounded-lg border p-4 transition-all duration-300',
              isWinner ? 'border-kpi-navy/30 bg-kpi-navy/3' : 'border-border-subtle bg-white',
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                {isWinner && totalBallots > 0 && (
                  <Crown className={cn('h-4 w-4 shrink-0', color.crown)} />
                )}
                <span
                  className={cn(
                    'font-body min-w-0 text-sm font-medium wrap-break-word',
                    isWinner ? 'text-kpi-navy' : 'text-foreground',
                  )}
                >
                  {choice.choice}
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
                  {pluralize(votes, ['голос', 'голоси', 'голосів'])}
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
                  transitionDelay: `${originalIndex * 100}ms`,
                }}
              />
            </div>
          </div>
        );
      })}

      {!choices.some((c) => c.winner === true) && (
        <Alert variant="warning" title="Переможця не визначено">
          {choices.length === 1 ? 'Варіант' : 'Жоден з варіантів'} не виконав умови для перемоги
        </Alert>
      )}
    </div>
  );
}
