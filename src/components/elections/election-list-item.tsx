import { Calendar, CheckCircle2, Crown, Eye, FileText, User, XCircle } from 'lucide-react';
import Link from 'next/link';

import { ElectionStatusBadge } from '@/components/elections/election-status-badge';
import { Badge } from '@/components/ui/badge';
import { LocalDate, LocalDateTime } from '@/components/ui/local-time';
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
          <ElectionStatusBadge status={election.status} size="sm" />

          {!election.anonymous && (
            <Badge size="sm" variant="warning">
              <Eye className="h-2.5 w-2.5" />
              Не анонімне
            </Badge>
          )}

          {voteStatus === 'cannot_vote' && (
            <Badge size="sm" variant="error">
              <XCircle className="h-2.5 w-2.5" />
              Не доступне
            </Badge>
          )}
          {voteStatus === 'voted' && (
            <Badge size="sm" variant="info">
              <CheckCircle2 className="h-2.5 w-2.5" />
              Проголосовано
            </Badge>
          )}
        </div>

        {/* Title */}
        <p className="font-display text-foreground group-hover:text-kpi-navy min-w-0 text-sm font-semibold wrap-break-word transition-colors duration-150 sm:text-base">
          {election.title}
        </p>

        {/* Author + date */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-body text-muted-foreground flex items-center gap-1.5 text-xs">
            <User className="h-3.5 w-3.5 shrink-0" />
            {election.creator.fullName}
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
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
            {hasWinners && <Crown className="text-kpi-navy h-3 w-3 shrink-0" />}
            {visibleChoices.map((c, i) => (
              <span
                key={i}
                className={cn(
                  'font-body max-w-36 truncate text-xs sm:max-w-52',
                  c.winner ? 'text-kpi-navy font-medium' : 'text-muted-foreground',
                )}
              >
                {c.choice}
                {i < visibleChoices.length - 1 && (
                  <span className="text-muted-foreground/40">,</span>
                )}
              </span>
            ))}
            {hiddenCount > 0 && (
              <span className="font-body text-muted-foreground/60 text-xs">+{hiddenCount}</span>
            )}
          </div>
        )}
      </div>

      {/* ── Right: ballot count — always visible on all screen sizes ───────── */}
      <div className="flex shrink-0 items-center gap-1.5 self-center">
        <span className="font-body text-muted-foreground text-sm tabular-nums">
          {election.ballotCount}
        </span>
        <FileText className="text-kpi-gray-mid h-4 w-4" />
      </div>
      {/* No ChevronRight — hover bg + title colour change are sufficient click cues */}
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
