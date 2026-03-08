'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { getBallots } from '@/lib/api-client';
import type { BallotsResponse, Ballot } from '@/types';

interface BallotsClientProps {
  electionId: number;
  initialData: BallotsResponse;
  initialPage: number;
}

export function BallotsClient({ electionId, initialData, initialPage }: BallotsClientProps) {
  const router = useRouter();
  const [data, setData] = useState<BallotsResponse>(initialData);
  const [page, setPage] = useState(initialPage);
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const foundBallot = searchQuery.trim()
    ? data.ballots.find(
        (b) =>
          b.current_hash.includes(searchQuery.trim()) ||
          (b.previous_hash?.includes(searchQuery.trim()) ?? false),
      )
    : null;

  const handlePageChange = async (newPage: number) => {
    startTransition(async () => {
      const result = await getBallots(electionId, newPage, 20);
      if (result.success) {
        setData(result.data);
        setPage(newPage);
        router.push(`?page=${newPage}`, { scroll: false });
      }
    });
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const { ballots, pagination } = data;
  const { total, totalPages } = pagination;

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Stats + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-2 text-sm font-body text-[var(--muted-foreground)]">
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
          <span>{total} бюлетенів</span>
        </div>

        {/* Hash search */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--kpi-gray-mid)] pointer-events-none">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Пошук за хешем бюлетеня…"
            className={cn(
              'w-full h-9 pl-9 pr-9 text-sm font-mono',
              'bg-white border border-[var(--border-color)] rounded-[var(--radius-lg)]',
              'placeholder:text-[var(--subtle)] placeholder:font-body',
              'focus:outline-none focus:border-[var(--kpi-blue-light)] focus:ring-2 focus:ring-[var(--kpi-blue-light)]/20',
              'transition-colors duration-150 shadow-[var(--shadow-xs)]',
            )}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Search result highlight */}
      {searchQuery && (
        <div
          className={cn(
            'p-4 rounded-[var(--radius-lg)] border text-sm font-body',
            foundBallot
              ? 'bg-[var(--success-bg)] border-[var(--success)]/30 text-[var(--success)]'
              : 'bg-[var(--error-bg)] border-[var(--error)]/30 text-[var(--error)]',
          )}
        >
          {foundBallot ? (
            <span className="flex items-center gap-2">
              <svg
                className="w-4 h-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Бюлетень знайдено на цій сторінці (бюлетень #{foundBallot.id})
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg
                className="w-4 h-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              На цій сторінці не знайдено — спробуйте на іншій
            </span>
          )}
        </div>
      )}

      {/* Ballots list */}
      {ballots.length === 0 ? (
        <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-[var(--kpi-gray-mid)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="font-display text-lg font-semibold text-[var(--foreground)]">
            Бюлетенів поки немає
          </p>
          <p className="text-sm text-[var(--muted-foreground)] font-body mt-1">
            Голосів ще не подано
          </p>
        </div>
      ) : (
        <div
          className={cn(
            'bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] overflow-hidden',
            isPending && 'opacity-60 pointer-events-none',
          )}
        >
          <div className="divide-y divide-[var(--border-subtle)]">
            {ballots.map((ballot, index) => (
              <BallotRow
                key={ballot.id}
                ballot={ballot}
                index={(page - 1) * 20 + index + 1}
                isHighlighted={!!foundBallot && foundBallot.id === ballot.id}
                isExpanded={expandedIds.has(ballot.id)}
                onToggle={() => toggleExpand(ballot.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between py-2">
          <p className="text-sm text-[var(--muted-foreground)] font-body">
            Сторінка {page} з {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1 || isPending}
              onClick={() => handlePageChange(page - 1)}
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              }
            >
              Назад
            </Button>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p: number;
                if (totalPages <= 5) p = i + 1;
                else if (page <= 3) p = i + 1;
                else if (page >= totalPages - 2) p = totalPages - 4 + i;
                else p = page - 2 + i;
                return (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    disabled={isPending}
                    className={cn(
                      'w-8 h-8 rounded-[var(--radius)] text-sm font-body font-medium transition-all duration-150',
                      p === page
                        ? 'bg-[var(--kpi-navy)] text-white shadow-[var(--shadow-sm)]'
                        : 'text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]',
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages || isPending}
              onClick={() => handlePageChange(page + 1)}
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              }
              iconPosition="right"
            >
              Вперед
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== BALLOT ROW ====================

interface BallotRowProps {
  ballot: Ballot;
  index: number;
  isHighlighted: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

function BallotRow({ ballot, index, isHighlighted, isExpanded, onToggle }: BallotRowProps) {
  return (
    <div
      className={cn('transition-colors duration-200', isHighlighted && 'bg-[var(--success-bg)]')}
    >
      {/* Main row */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-4 px-5 py-4 text-left',
          'hover:bg-[var(--surface)] transition-colors duration-150',
          isHighlighted && 'hover:bg-[var(--success-bg)]/80',
        )}
      >
        {/* Index */}
        <span className="w-8 text-xs font-body text-[var(--muted-foreground)] shrink-0 text-right tabular-nums">
          {index}
        </span>

        {/* Hashes */}
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-mono text-xs text-[var(--foreground)] truncate">
            {ballot.current_hash}
          </p>
          {ballot.previous_hash && (
            <p className="font-mono text-[10px] text-[var(--muted-foreground)] truncate">
              ← {ballot.previous_hash}
            </p>
          )}
        </div>

        {/* Chain indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          {ballot.previous_hash ? (
            <span className="flex items-center gap-1 text-[10px] font-body text-[var(--success)] bg-[var(--success-bg)] px-1.5 py-0.5 rounded-full border border-[var(--success)]/20">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              ланцюг
            </span>
          ) : (
            <span className="text-[10px] font-body text-[var(--kpi-orange)] bg-[var(--warning-bg)] px-1.5 py-0.5 rounded-full border border-[var(--kpi-orange)]/20">
              перший
            </span>
          )}
        </div>

        {/* Expand icon */}
        <svg
          className={cn(
            'w-4 h-4 text-[var(--muted-foreground)] transition-transform duration-200 shrink-0',
            isExpanded && 'rotate-180',
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-5 pb-4 pl-17 border-t border-[var(--border-subtle)] bg-[var(--surface)]/50">
          <div className="pt-4 space-y-4 ml-12">
            <div>
              <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider font-body mb-1.5">
                Зашифрований бюлетень
              </p>
              <div className="p-3 bg-white rounded-[var(--radius)] border border-[var(--border-subtle)] overflow-x-auto">
                <p className="font-mono text-[10px] text-[var(--foreground)] break-all leading-relaxed">
                  {ballot.encrypted_ballot}
                </p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider font-body mb-1.5">
                Підпис
              </p>
              <div className="p-3 bg-white rounded-[var(--radius)] border border-[var(--border-subtle)] overflow-x-auto">
                <p className="font-mono text-[10px] text-[var(--foreground)] break-all leading-relaxed">
                  {ballot.signature}
                </p>
              </div>
            </div>
            {ballot.previous_hash && (
              <div>
                <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider font-body mb-1.5">
                  Попередній хеш
                </p>
                <div className="p-3 bg-white rounded-[var(--radius)] border border-[var(--border-subtle)]">
                  <p className="font-mono text-[10px] text-[var(--foreground)] break-all">
                    {ballot.previous_hash}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
