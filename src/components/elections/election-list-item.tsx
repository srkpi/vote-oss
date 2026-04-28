import { Calendar, Crown, FileText, User } from 'lucide-react';
import Link from 'next/link';

import { LocalDate, LocalDateTime } from '@/components/ui/local-time';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils/common';
import type { Election } from '@/types/election';

interface ElectionListItemProps {
  election: Election;
  index?: number;
}

// Show up to this many choices before "+N more"
const MAX_VISIBLE_CHOICES = 4;

export function ElectionListItem({ election, index = 0 }: ElectionListItemProps) {
  const isOpen = election.status === 'open';
  const isUpcoming = election.status === 'upcoming';
  const isClosed = election.status === 'closed';
  const voteStatus = election.voteStatus;

  const winnerChoices = election.choices.filter((c) => c.winner === true);
  const hasWinners = winnerChoices.length > 0;
  const orderedChoices = hasWinners
    ? [...winnerChoices, ...election.choices.filter((c) => !c.winner)]
    : election.choices;
  const visibleChoices = orderedChoices.slice(0, MAX_VISIBLE_CHOICES);
  const hiddenCount = orderedChoices.length - visibleChoices.length;

  // Left status stripe color
  const stripeClass = cn(
    isOpen && voteStatus === 'can_vote' && 'bg-success',
    isOpen && voteStatus === 'voted' && 'bg-kpi-blue-light',
    isOpen && voteStatus === 'cannot_vote' && 'bg-rose-400',
    isOpen && !voteStatus && 'bg-success',
    isUpcoming && 'bg-kpi-orange',
    isClosed && 'bg-kpi-gray-light',
  );

  return (
    <Link
      href={`/elections/${election.id}`}
      className={cn(
        'group flex items-stretch gap-4 px-4 py-4 sm:px-6',
        'border-border-subtle border-b last:border-b-0',
        'hover:bg-surface transition-colors duration-150',
        'animate-fade-up',
        voteStatus === 'cannot_vote' && 'opacity-70 hover:opacity-100',
      )}
      style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'both' }}
    >
      {/* ── Status stripe — stretches to full row height ────────────────── */}
      <div className={cn('w-1 shrink-0 self-stretch rounded-sm', stripeClass)} />

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1 space-y-1.5 self-center">
        {/* Badge row */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={election.status} size="sm" />

          {!election.anonymous && <StatusBadge status="nonanonymous" size="sm" />}

          {voteStatus === 'cannot_vote' && <StatusBadge status="unavailable" />}
          {voteStatus === 'voted' && <StatusBadge status="voted" />}
        </div>

        {/* Title */}
        <p className="font-display text-foreground group-hover:text-kpi-navy min-w-0 text-sm font-semibold wrap-break-word transition-colors duration-150 sm:text-base">
          {election.title}
        </p>

        {/* Author + date */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-body text-muted-foreground flex items-center gap-1.5 text-xs">
            <User className="h-3.5 w-3.5 shrink-0" />
            {election.createdBy.fullName}
          </span>
          <span className="font-body text-muted-foreground flex items-center gap-1.5 text-xs">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            {isOpen && (
              <>
                До <LocalDateTime date={election.closesAt} />
              </>
            )}
            {isUpcoming && (
              <>
                З <LocalDateTime date={election.opensAt} />
              </>
            )}
            {isClosed && <LocalDate date={election.closesAt} />}
          </span>
        </div>

        {/* Choices — own line, separate from author/date */}
        {orderedChoices.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {visibleChoices.map((c) => (
              <span
                key={c.id}
                className={cn(
                  'font-body flex items-center gap-1 truncate rounded-full border px-2 py-0.5 text-xs',
                  c.winner
                    ? 'border-kpi-navy/30 bg-kpi-navy/8 text-kpi-navy font-semibold'
                    : 'bg-surface text-muted-foreground border-border-subtle',
                )}
              >
                {c.winner && <Crown className="h-2.5 w-2.5 shrink-0" />}
                {c.choice}
              </span>
            ))}
            {hiddenCount > 0 && (
              <span className="font-body text-muted-foreground/70 border-border-subtle bg-surface rounded-full border px-2 py-0.5 text-xs">
                +{hiddenCount}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Right: ballot count — always visible on all screen sizes ───────── */}
      <div className="flex shrink-0 items-center gap-1.5 self-center">
        <span className="font-body text-muted-foreground text-sm">{election.ballotCount}</span>
        <FileText className="text-kpi-gray-mid h-4 w-4" />
      </div>
    </Link>
  );
}

export function ElectionListItemSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="animate-fade-up border-border-subtle flex items-stretch gap-4 border-b px-4 py-4 last:border-b-0 sm:px-6"
      style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'both' }}
    >
      <div className="skeleton w-1 self-stretch rounded-sm" />
      <div className="min-w-0 flex-1 space-y-2 self-center">
        <div className="skeleton h-4 w-24 rounded-full" />
        <div className="skeleton h-5 w-3/4 rounded" />
        <div className="flex gap-3">
          <div className="skeleton h-3 w-28 rounded" />
          <div className="skeleton h-3 w-32 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-3 w-16 rounded" />
        </div>
      </div>
      <div className="skeleton h-4 w-10 self-center rounded" />
    </div>
  );
}
