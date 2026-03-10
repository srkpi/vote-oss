'use client';

import { FileText } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { ElectionCard, ElectionCardSkeleton } from '@/components/elections/election-card';
import { SearchInput } from '@/components/ui/search-input';
import { Tabs } from '@/components/ui/tabs';
import type { Election, ElectionStatus } from '@/types/election';

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
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} tabCount={tabCount} />
        <SearchInput value={search} onChange={setSearch} placeholder="Пошук голосувань…" />
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
