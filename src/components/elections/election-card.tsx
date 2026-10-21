import { Calendar, Crown, FileText } from 'lucide-react';
import Link from 'next/link';

import { Avatar } from '@/components/ui/avatar';
import { LocalDate, LocalDateTime } from '@/components/ui/local-time';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn, pluralize } from '@/lib/utils/common';
import type { Election } from '@/types/election';

interface ElectionCardProps {
  election: Election;
  index?: number;
}

function sortedChoicesForDisplay(election: Election) {
  const hasTally = election.choices.some((c) => c.winner !== undefined);

  if (election.status !== 'closed' || !hasTally) {
    return election.choices;
  }

  return [...election.choices].sort((a, b) => {
    // Winners first
    const aWinner = a.winner ? 1 : 0;
    const bWinner = b.winner ? 1 : 0;
    if (bWinner !== aWinner) return bWinner - aWinner;
    // Then by votes descending
    const aVotes = a.votes ?? 0;
    const bVotes = b.votes ?? 0;
    if (bVotes !== aVotes) return bVotes - aVotes;
    // Fall back to position
    return a.position - b.position;
  });
}

export function ElectionCard({ election, index = 0 }: ElectionCardProps) {
  const isOpen = election.status === 'open';
  const isUpcoming = election.status === 'upcoming';
  const isClosed = election.status === 'closed';
  const isNonAnonymous = !election.anonymous;

  const displayChoices = sortedChoicesForDisplay(election);
  const shownChoices = displayChoices.slice(0, 3);
  const hiddenCount = election.choices.length - shownChoices.length;

  const voteStatus = election.voteStatus;

  return (
    <div
      className={cn(
        'group relative',
        'rounded-xl bg-card',
        'border-border-color border',
        'shadow-card',
        'hover:shadow-card-hover',
        'hover:-translate-y-1',
        'transition-all duration-300',
        'overflow-hidden',
        'animate-fade-up',
      )}
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
    >
      <Link
        href={`/elections/${election.id}`}
        className={cn(
          'absolute inset-0 z-0 rounded-xl',
          'focus-visible:ring-2 focus-visible:ring-kpi-blue-light focus-visible:outline-none focus-visible:ring-inset',
        )}
        aria-label={election.title}
      />

      <div
        className={cn(
          'h-1',
          isOpen && voteStatus === 'can_vote' && 'bg-linear-to-r from-success to-emerald-400',
          isOpen && voteStatus === 'voted' && 'bg-linear-to-r from-kpi-blue-light to-blue-400',
          isOpen && voteStatus === 'cannot_vote' && 'bg-linear-to-r from-rose-400 to-rose-300',
          isOpen && !voteStatus && 'bg-linear-to-r from-success to-emerald-400',
          isUpcoming && 'bg-linear-to-r from-kpi-orange to-amber-400',
          isClosed && 'bg-linear-to-r from-kpi-gray-light to-gray-300',
        )}
      />

      <div className="flex h-full flex-col space-y-3 p-6">
        <div className="flex items-start justify-between gap-3">
          <StatusBadge status={election.status} />
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {isNonAnonymous && <StatusBadge status="nonanonymous" />}
          </div>
        </div>

        <h3
          className={cn(
            'font-display text-xl leading-snug font-semibold text-foreground',
            'line-clamp-2 wrap-break-word transition-colors duration-200 group-hover:text-kpi-navy',
          )}
        >
          {election.title}
        </h3>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0 text-kpi-gray-mid" />
            <span>
              {isOpen && (
                <>
                  Діє до <LocalDateTime date={election.closesAt} />
                </>
              )}
              {isUpcoming && (
                <>
                  Починається <LocalDateTime date={election.opensAt} />
                </>
              )}
              {isClosed && (
                <>
                  Завершено <LocalDate date={election.closesAt} />
                </>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Avatar
              icon
              src={election.createdBy.avatarUrl}
              name={election.createdBy.fullName}
              size={16}
            />
            <span>{election.createdBy.fullName}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {shownChoices.map((choice) => {
            const isWinner = choice.winner === true;
            return (
              <span
                key={choice.id}
                className={cn(
                  'font-body rounded-full px-2.5 py-1 text-xs',
                  'truncate border',
                  'flex items-center gap-1',
                  isWinner
                    ? 'border-kpi-navy/30 bg-kpi-navy/8 font-semibold text-kpi-navy'
                    : 'border-border-subtle bg-surface text-muted-foreground',
                )}
              >
                {isWinner && <Crown className="h-2.5 w-2.5 shrink-0" />}
                {choice.choice}
              </span>
            );
          })}
          {hiddenCount > 0 && (
            <span className="rounded-full border border-border-subtle bg-surface px-2.5 py-1 text-xs text-muted-foreground">
              +{hiddenCount}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-border-subtle pt-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <FileText className="h-4 w-4 text-kpi-gray-mid" />
              <span>{pluralize(election.ballotCount, ['голос', 'голоси', 'голосів'])}</span>
            </div>
            {voteStatus === 'cannot_vote' && <StatusBadge status="unavailable" />}
            {voteStatus === 'voted' && <StatusBadge status="voted" />}
          </div>
        </div>
      </div>
    </div>
  );
}
