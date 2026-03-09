'use client';

import { useState, useMemo } from 'react';
import { Search, X, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ElectionCard, ElectionCardSkeleton } from '@/components/elections/election-card';
import { EmptyState } from '@/components/common/empty-state';
import type { Election, ElectionStatus } from '@/types';

interface ElectionsFilterProps {
  elections: Election[];
  counts: {
    open: number;
    upcoming: number;
    closed: number;
    total: number;
  };
}

type TabKey = 'all' | ElectionStatus;

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'Усі' },
  { key: 'open', label: 'Активні' },
  { key: 'upcoming', label: 'Майбутні' },
  { key: 'closed', label: 'Завершені' },
];

export function ElectionsFilter({ elections, counts }: ElectionsFilterProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let result = elections;

    if (activeTab !== 'all') {
      result = result.filter((e) => e.status === activeTab);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.creator.full_name.toLowerCase().includes(q) ||
          (e.restrictedToFaculty?.toLowerCase().includes(q) ?? false) ||
          (e.restrictedToGroup?.toLowerCase().includes(q) ?? false),
      );
    }

    return result;
  }, [elections, activeTab, search]);

  const tabCount = (key: TabKey): number => {
    if (key === 'all') return counts.total;
    if (key === 'open') return counts.open;
    if (key === 'upcoming') return counts.upcoming;
    if (key === 'closed') return counts.closed;
    return 0;
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Tabs + Search bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-white border border-[var(--border-subtle)] rounded-[var(--radius-lg)] shadow-[var(--shadow-xs)] overflow-x-auto shrink-0">
          {TABS.map((tab) => {
            const count = tabCount(tab.key);
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-sm font-medium font-body',
                  'transition-all duration-150 whitespace-nowrap',
                  isActive
                    ? 'bg-[var(--kpi-navy)] text-white shadow-[var(--shadow-sm)]'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]',
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold px-1',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-[var(--surface)] text-[var(--muted-foreground)]',
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--kpi-gray-mid)] pointer-events-none">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук голосувань…"
            className={cn(
              'w-full h-9 pl-9 pr-3 text-sm font-body',
              'bg-white border border-[var(--border-color)] rounded-[var(--radius-lg)]',
              'placeholder:text-[var(--subtle)]',
              'focus:outline-none focus:border-[var(--kpi-blue-light)] focus:ring-2 focus:ring-[var(--kpi-blue-light)]/20',
              'transition-colors duration-150',
              'shadow-[var(--shadow-xs)]',
            )}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      {(search || activeTab !== 'all') && filtered.length > 0 && (
        <p className="text-xs text-[var(--muted-foreground)] font-body">
          Знайдено: {filtered.length} голосувань
        </p>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)]">
          <EmptyState
            icon={<FileText className="w-8 h-8" />}
            title={search ? 'Голосувань не знайдено' : 'Голосувань поки що немає'}
            description={
              search
                ? `За запитом "${search}" нічого не знайдено. Спробуйте інший запит.`
                : 'У цій категорії немає жодного голосування.'
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((election, index) => (
            <ElectionCard key={election.id} election={election} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ElectionsFilterSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <div className="skeleton h-9 w-64 rounded-[var(--radius-lg)]" />
        <div className="skeleton h-9 w-48 rounded-[var(--radius-lg)]" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <ElectionCardSkeleton key={i} index={i - 1} />
        ))}
      </div>
    </div>
  );
}
