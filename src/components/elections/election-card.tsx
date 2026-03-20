import { Calendar, ChevronRight, FileText, Lock, User } from 'lucide-react';
import Link from 'next/link';

import { ElectionStatusBadge } from '@/components/elections/election-status-badge';
import { cn, formatDate, formatDateTime, pluralize } from '@/lib/utils';
import type { Election } from '@/types/election';

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
        'rounded-xl bg-white',
        'border border-(--border-color)',
        'shadow-(--shadow-card)',
        'hover:shadow-(--shadow-card-hover)',
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
          isOpen && 'bg-linear-to-r from-(--success) to-emerald-400',
          isUpcoming && 'bg-linear-to-r from-(--kpi-orange) to-amber-400',
          isClosed && 'bg-linear-to-r from-(--kpi-gray-light) to-(--border-color)',
        )}
      />

      <div className="p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <ElectionStatusBadge status={election.status} />
          {(election.restrictedToFaculty || election.restrictedToGroup) && (
            <div className="flex items-center gap-1 text-xs text-(--muted-foreground)">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span>
                {election.restrictedToGroup
                  ? election.restrictedToGroup
                  : election.restrictedToFaculty}
              </span>
            </div>
          )}
        </div>

        <h3
          className={cn(
            'font-display mb-3 text-xl leading-snug font-semibold text-(--foreground)',
            'line-clamp-2 wrap-break-word transition-colors duration-200 group-hover:text-(--kpi-navy)',
          )}
        >
          {election.title}
        </h3>

        <div className="mb-5 space-y-2">
          <div className="flex items-center gap-2 text-sm text-(--muted-foreground)">
            <Calendar className="h-4 w-4 shrink-0 text-(--kpi-gray-mid)" />
            <span>
              {isOpen && <>Діє до {formatDateTime(election.closesAt)}</>}
              {isUpcoming && <>Починається {formatDateTime(election.opensAt)}</>}
              {isClosed && <>Завершено {formatDate(election.closesAt)}</>}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-(--muted-foreground)">
            <User className="h-4 w-4 shrink-0 text-(--kpi-gray-mid)" />
            <span>{election.creator.full_name}</span>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {election.choices.slice(0, 3).map((choice) => (
            <span
              key={choice.id}
              className={cn(
                'font-body rounded-full px-2.5 py-1 text-xs',
                'bg-(--surface) text-(--muted-foreground)',
                'truncate border border-(--border-subtle)',
              )}
            >
              {choice.choice}
            </span>
          ))}
          {election.choices.length > 3 && (
            <span className="rounded-full border border-(--border-subtle) bg-(--surface) px-2.5 py-1 text-xs text-(--muted-foreground)">
              +{election.choices.length - 3}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-(--border-subtle) pt-4">
          <div className="flex items-center gap-1.5 text-sm text-(--muted-foreground)">
            <FileText className="h-4 w-4 text-(--kpi-gray-mid)" />
            <span>{pluralize(election.ballotCount, ['голос', 'голоси', 'голосів'])}</span>
          </div>

          <div
            className={cn(
              'flex items-center gap-1.5 text-sm font-medium',
              'text-(--kpi-navy) opacity-0 group-hover:opacity-100',
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
      className="animate-fade-up overflow-hidden rounded-xl border border-(--border-color) bg-white"
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
