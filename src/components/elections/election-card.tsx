import Link from 'next/link';
import { cn, formatDate, formatDateTime, pluralize } from '@/lib/utils';
import { ElectionStatusBadge } from './election-status-badge';
import type { Election } from '@/types';

interface ElectionCardProps {
  election: Election;
  index?: number;
}

export function ElectionCard({ election, index = 0 }: ElectionCardProps) {
  const isOpen = election.status === 'open';
  const isUpcoming = election.status === 'upcoming';
  const isClosed = election.status === 'closed';

  return (
    <Link
      href={`/elections/${election.id}`}
      className={cn(
        'group block',
        'bg-white rounded-[var(--radius-xl)]',
        'border border-[var(--border-color)]',
        'shadow-[var(--shadow-card)]',
        'hover:shadow-[var(--shadow-card-hover)]',
        'hover:-translate-y-1',
        'transition-all duration-300',
        'overflow-hidden',
        'animate-fade-up',
      )}
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
    >
      {/* Top accent bar */}
      <div
        className={cn(
          'h-1',
          isOpen && 'bg-gradient-to-r from-[var(--success)] to-emerald-400',
          isUpcoming && 'bg-gradient-to-r from-[var(--kpi-orange)] to-amber-400',
          isClosed && 'bg-gradient-to-r from-[var(--kpi-gray-light)] to-[var(--border-color)]',
        )}
      />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <ElectionStatusBadge status={election.status} />

          {/* Faculty / Group restriction indicator */}
          {(election.restrictedToFaculty || election.restrictedToGroup) && (
            <div className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
              <svg
                className="w-3.5 h-3.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <span>
                {election.restrictedToGroup
                  ? election.restrictedToGroup
                  : election.restrictedToFaculty}
              </span>
            </div>
          )}
        </div>

        {/* Title */}
        <h3
          className={cn(
            'font-display text-xl font-semibold text-[var(--foreground)] leading-snug mb-3',
            'group-hover:text-[var(--kpi-navy)] transition-colors duration-200',
          )}
        >
          {election.title}
        </h3>

        {/* Meta info */}
        <div className="space-y-2 mb-5">
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <svg
              className="w-4 h-4 shrink-0 text-[var(--kpi-gray-mid)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>
              {isOpen && <>Діє до {formatDateTime(election.closesAt)}</>}
              {isUpcoming && <>Починається {formatDateTime(election.opensAt)}</>}
              {isClosed && <>Завершено {formatDate(election.closesAt)}</>}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <svg
              className="w-4 h-4 shrink-0 text-[var(--kpi-gray-mid)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span>{election.creator.full_name}</span>
          </div>
        </div>

        {/* Choices preview */}
        <div className="flex flex-wrap gap-2 mb-5">
          {election.choices.slice(0, 3).map((choice) => (
            <span
              key={choice.id}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full font-body',
                'bg-[var(--surface)] text-[var(--muted-foreground)]',
                'border border-[var(--border-subtle)]',
              )}
            >
              {choice.choice}
            </span>
          ))}
          {election.choices.length > 3 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--surface)] text-[var(--muted-foreground)] border border-[var(--border-subtle)]">
              +{election.choices.length - 3}
            </span>
          )}
        </div>

        {/* Footer stats */}
        <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
          <div className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
            <svg
              className="w-4 h-4 text-[var(--kpi-gray-mid)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span>{pluralize(election.ballotCount, ['голос', 'голоси', 'голосів'])}</span>
          </div>

          <div
            className={cn(
              'flex items-center gap-1.5 text-sm font-medium',
              'text-[var(--kpi-navy)] opacity-0 group-hover:opacity-100',
              'transition-opacity duration-200',
            )}
          >
            <span>{isOpen ? 'Проголосувати' : 'Переглянути'}</span>
            <svg
              className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}

// Skeleton card for loading state
export function ElectionCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] overflow-hidden animate-fade-up"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
    >
      <div className="h-1 skeleton" />
      <div className="p-6 space-y-4">
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
