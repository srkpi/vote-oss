import { Calendar, ChevronRight, Crown, FileText, User } from 'lucide-react';
import Link from 'next/link';

import { ElectionStatusBadge } from '@/components/elections/election-status-badge';
import { cn, formatDate, formatDateTime, pluralize } from '@/lib/utils';
import type { Election, TallyResult } from '@/types/election';

interface ElectionCardProps {
  election: Election;
  index?: number;
}

/**
 * Sort choices for display in the card.
 * For closed elections with results: winner(s) first, then by vote count desc, then position.
 * For other elections: original position order.
 */
function sortedChoicesForDisplay(
  election: Election,
): Array<{ id: string; choice: string; position: number; result?: TallyResult }> {
  if (election.status !== 'closed' || !election.results) {
    return election.choices;
  }

  const resultsMap = new Map(election.results.map((r) => [r.choiceId, r]));

  return [...election.choices]
    .map((c) => ({ ...c, result: resultsMap.get(c.id) }))
    .sort((a, b) => {
      // Winners come first
      const aWinner = a.result?.winner ? 1 : 0;
      const bWinner = b.result?.winner ? 1 : 0;
      if (bWinner !== aWinner) return bWinner - aWinner;
      // Then by votes descending
      const aVotes = a.result?.votes ?? 0;
      const bVotes = b.result?.votes ?? 0;
      if (bVotes !== aVotes) return bVotes - aVotes;
      // Fall back to position
      return a.position - b.position;
    });
}

export function ElectionCard({ election, index = 0 }: ElectionCardProps) {
  const isOpen = election.status === 'open';
  const isUpcoming = election.status === 'upcoming';
  const isClosed = election.status === 'closed';

  const displayChoices = sortedChoicesForDisplay(election);
  const shownChoices = displayChoices.slice(0, 3);
  const hiddenCount = election.choices.length - shownChoices.length;

  return (
    <Link
      href={`/elections/${election.id}`}
      className={cn(
        'group block',
        'rounded-xl bg-white',
        'border-border-color border',
        'shadow-shadow-card',
        'hover:shadow-shadow-card-hover',
        'hover:-translate-y-1',
        'transition-all duration-300',
        'overflow-hidden',
        'animate-fade-up',
      )}
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
    >
      <div
        className={cn(
          'h-1',
          isOpen && 'from-success bg-linear-to-r to-emerald-400',
          isUpcoming && 'from-kpi-orange bg-linear-to-r to-amber-400',
          isClosed && 'from-kpi-gray-light bg-linear-to-r to-gray-300',
        )}
      />

      <div className="p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <ElectionStatusBadge status={election.status} />
        </div>

        <h3
          className={cn(
            'font-display text-foreground mb-3 text-xl leading-snug font-semibold',
            'group-hover:text-kpi-navy line-clamp-2 wrap-break-word transition-colors duration-200',
          )}
        >
          {election.title}
        </h3>

        <div className="mb-5 space-y-2">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Calendar className="text-kpi-gray-mid h-4 w-4 shrink-0" />
            <span>
              {isOpen && <>Діє до {formatDateTime(election.closesAt)}</>}
              {isUpcoming && <>Починається {formatDateTime(election.opensAt)}</>}
              {isClosed && <>Завершено {formatDate(election.closesAt)}</>}
            </span>
          </div>

          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <User className="text-kpi-gray-mid h-4 w-4 shrink-0" />
            <span>{election.creator.fullName}</span>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {shownChoices.map((choice) => {
            const isWinner = 'result' in choice && choice.result?.winner === true;
            return (
              <span
                key={choice.id}
                className={cn(
                  'font-body rounded-full px-2.5 py-1 text-xs',
                  'truncate border',
                  'flex items-center gap-1',
                  isWinner
                    ? 'border-kpi-navy/30 bg-kpi-navy/8 text-kpi-navy font-semibold'
                    : 'bg-surface text-muted-foreground border-border-subtle',
                )}
              >
                {isWinner && <Crown className="h-2.5 w-2.5 shrink-0" />}
                {choice.choice}
              </span>
            );
          })}
          {hiddenCount > 0 && (
            <span className="border-border-subtle bg-surface text-muted-foreground rounded-full border px-2.5 py-1 text-xs">
              +{hiddenCount}
            </span>
          )}
        </div>

        <div className="border-border-subtle flex items-center justify-between border-t pt-4">
          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <FileText className="text-kpi-gray-mid h-4 w-4" />
            <span>{pluralize(election.ballotCount, ['голос', 'голоси', 'голосів'])}</span>
          </div>

          <div
            className={cn(
              'flex items-center gap-1.5 text-sm font-medium',
              'text-kpi-navy opacity-0 group-hover:opacity-100',
              'transition-opacity duration-200',
            )}
          >
            <span>{isOpen ? 'Проголосувати' : 'Переглянути'}</span>
            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </Link>
  );
}

export function ElectionCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="animate-fade-up border-border-color overflow-hidden rounded-xl border bg-white"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
    >
      <div className="skeleton h-1" />
      <div className="space-y-4 p-6">
        <div className="skeleton h-5 w-24 rounded-full" />
        <div className="space-y-2">
          <div className="skeleton h-6 w-3/4 rounded" />
          <div className="skeleton h-4 w-1/2 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton h-6 w-16 rounded-full" />
          <div className="skeleton h-6 w-20 rounded-full" />
          <div className="skeleton h-6 w-14 rounded-full" />
        </div>
        <div className="skeleton h-px w-full" />
        <div className="flex justify-between">
          <div className="skeleton h-4 w-20 rounded" />
          <div className="skeleton h-4 w-24 rounded" />
        </div>
      </div>
    </div>
  );
}
