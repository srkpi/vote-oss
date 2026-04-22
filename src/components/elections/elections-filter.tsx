'use client';

import { FileText, LayoutGrid, LayoutList } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { ElectionCard, ElectionCardSkeleton } from '@/components/elections/election-card';
import { ElectionListItem } from '@/components/elections/election-list-item';
import { ElectionsFiltersButton } from '@/components/elections/elections-filter-panel';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Tabs } from '@/components/ui/tabs';
import { ELECTIONS_PAGE_SIZE, LOCAL_STORAGE_ELECTIONS_VIEW_KEY } from '@/lib/constants';
import { pluralize } from '@/lib/utils/common';
import type { Election, ElectionsFilterMeta } from '@/types/election';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ElectionStatusFilter = 'open' | 'upcoming' | 'closed';

export interface ElectionsFilterState {
  // Multi-select: empty array = show all statuses
  statuses: ElectionStatusFilter[];
  // 'available'  = can_vote OR voted (user has/had access)
  // 'not_voted'  = can_vote only (user can still act)
  // 'voted'      = voted
  // 'cannot_vote'= not eligible
  voteStatus: 'all' | 'available' | 'voted' | 'not_voted' | 'cannot_vote';
  anonymous: 'all' | 'anonymous' | 'non_anonymous';
  faculties: string[];
  studyForms: string[];
}

const DEFAULT_FILTER_STATE: ElectionsFilterState = {
  statuses: [],
  voteStatus: 'available',
  anonymous: 'all',
  faculties: [],
  studyForms: [],
};

type ViewMode = 'grid' | 'list';

const VIEW_TABS: { key: ViewMode; icon: React.ReactNode }[] = [
  { key: 'grid', icon: <LayoutGrid className="h-4 w-4" /> },
  { key: 'list', icon: <LayoutList className="h-4 w-4" /> },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface ElectionsFilterProps {
  elections: Election[];
  meta: ElectionsFilterMeta;
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

function countActiveFilters(state: ElectionsFilterState): number {
  let count = 0;
  if (state.statuses.length > 0) count++;
  if (state.voteStatus !== DEFAULT_FILTER_STATE.voteStatus) count++;
  if (state.anonymous !== DEFAULT_FILTER_STATE.anonymous) count++;
  if (state.faculties.length > 0) count++;
  if (state.studyForms.length > 0) count++;
  return count;
}

function matchesFilters(election: Election, filters: ElectionsFilterState): boolean {
  // Statuses: multi-select OR — empty means show all
  if (filters.statuses.length > 0 && !filters.statuses.includes(election.status)) return false;

  // Vote status
  if (filters.voteStatus !== 'all') {
    const vs = election.voteStatus;
    if (vs) {
      switch (filters.voteStatus) {
        case 'available':
          if (vs !== 'can_vote' && vs !== 'voted') return false;
          break;
        case 'voted':
          if (vs !== 'voted') return false;
          break;
        case 'not_voted':
          if (vs !== 'can_vote') return false;
          break;
        case 'cannot_vote':
          if (vs !== 'cannot_vote') return false;
          break;
      }
    }
    // If no voteStatus present (admin view), skip this filter
  }

  // Anonymous
  if (filters.anonymous !== 'all') {
    if (filters.anonymous === 'anonymous' && !election.anonymous) return false;
    if (filters.anonymous === 'non_anonymous' && election.anonymous) return false;
  }

  // Faculty (OR — election must have at least one matching faculty)
  if (filters.faculties.length > 0) {
    const electionFaculties = election.restrictions
      .filter((r) => r.type === 'FACULTY')
      .map((r) => r.value);
    if (electionFaculties.length === 0) return false;
    if (!filters.faculties.some((f) => electionFaculties.includes(f))) return false;
  }

  // Study form (OR)
  if (filters.studyForms.length > 0) {
    const electionForms = election.restrictions
      .filter((r) => r.type === 'STUDY_FORM')
      .map((r) => r.value);
    if (electionForms.length === 0) return false;
    if (!filters.studyForms.some((sf) => electionForms.includes(sf))) return false;
  }

  return true;
}

function matchesSearch(election: Election, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    election.title.toLowerCase().includes(q) || election.creator.fullName.toLowerCase().includes(q)
  );
}

// ─── Adaptive count helper ────────────────────────────────────────────────────
//
// For a SELECTED option we keep it in the selection — so the count equals
// the current result set size (what the user is actually seeing).
//
// For an UNSELECTED option we add it to the current selection — showing
// how many results would appear if the user selected it.
//
// This means clicking "ПБФ" and seeing 1 result will show "1" next to
// ПБФ in the list — never the misleading "19" (what you'd see without it).

function computeAdaptiveCount(
  elections: Election[],
  filters: ElectionsFilterState,
  search: string,
  overrides: Partial<ElectionsFilterState>,
): number {
  return elections.filter(
    (e) => matchesFilters(e, { ...filters, ...overrides }) && matchesSearch(e, search),
  ).length;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ElectionsFilter({ elections, meta }: ElectionsFilterProps) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ElectionsFilterState>(DEFAULT_FILTER_STATE);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [page, setPage] = useState(1);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_ELECTIONS_VIEW_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored === 'list' || stored === 'grid') setViewMode(stored);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(LOCAL_STORAGE_ELECTIONS_VIEW_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  const updateFilters = useCallback((next: Partial<ElectionsFilterState>) => {
    setFilters((prev) => ({ ...prev, ...next }));
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTER_STATE);
    setPage(1);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  // ── Adaptive counts ────────────────────────────────────────────────────────
  //
  // Status (multi-select):
  //   selected   → count using current statuses selection (includes this status)
  //   unselected → count with this status added to current selection
  const statusCounts = useMemo(() => {
    return Object.fromEntries(
      (['open', 'upcoming', 'closed'] as const).map((s) => {
        const newStatuses = filters.statuses.includes(s)
          ? filters.statuses // already selected → current result count for this status
          : [...filters.statuses, s]; // not selected → additive preview
        return [s, computeAdaptiveCount(elections, filters, search, { statuses: newStatuses })];
      }),
    );
  }, [elections, filters, search]);

  // Vote status (single-select):
  //   Each option shows the count IF that option were active, keeping all other filters.
  //   The currently-selected option therefore shows the actual current result count.
  const voteStatusCounts = useMemo(() => {
    return Object.fromEntries(
      (['all', 'available', 'voted', 'not_voted', 'cannot_vote'] as const).map((opt) => [
        opt,
        computeAdaptiveCount(elections, filters, search, { voteStatus: opt }),
      ]),
    );
  }, [elections, filters, search]);

  const anonymousCounts = useMemo(() => {
    return Object.fromEntries(
      (['all', 'anonymous', 'non_anonymous'] as const).map((opt) => [
        opt,
        computeAdaptiveCount(elections, filters, search, { anonymous: opt }),
      ]),
    );
  }, [elections, filters, search]);

  // Faculty / study form (multi-select):
  //   selected   → count with this option still IN the selection (= current count for this item)
  //   unselected → count with this option ADDED to current selection
  const facultyCounts = useMemo(() => {
    return Object.fromEntries(
      meta.faculties.map((f) => {
        const newFaculties = filters.faculties.includes(f)
          ? filters.faculties // already selected → reflects current filtered count
          : [...filters.faculties, f]; // additive preview
        return [f, computeAdaptiveCount(elections, filters, search, { faculties: newFaculties })];
      }),
    );
  }, [elections, filters, search, meta.faculties]);

  const studyFormCounts = useMemo(() => {
    return Object.fromEntries(
      meta.studyForms.map((sf) => {
        const newForms = filters.studyForms.includes(sf)
          ? filters.studyForms
          : [...filters.studyForms, sf];
        return [sf, computeAdaptiveCount(elections, filters, search, { studyForms: newForms })];
      }),
    );
  }, [elections, filters, search, meta.studyForms]);

  // ── Filtered + paged ──────────────────────────────────────────────────────
  const filtered = useMemo(
    () => elections.filter((e) => matchesFilters(e, filters) && matchesSearch(e, search)),
    [elections, filters, search],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / ELECTIONS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (safePage - 1) * ELECTIONS_PAGE_SIZE,
    safePage * ELECTIONS_PAGE_SIZE,
  );

  const hasDifferentFromDefault = activeFilterCount > 0 || !!search;
  const searchTrimmed = search.length > 80 ? search.slice(0, 80) + '…' : search;

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <div className="flex gap-3">
          <div className="skeleton h-9 w-64 rounded-lg" />
          <div className="skeleton h-9 w-24 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ElectionCardSkeleton key={i} index={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/*
         * Mobile layout:  [Filters]  ·····  [View toggle]
         *                 [Search — full width]
         *
         * Desktop layout: [Search ────────────────] [Filters] [View toggle]
         */}
        <div className="flex items-center gap-3">
          {/* Search — desktop only in this row */}
          <div className="hidden flex-1 sm:block">
            <SearchInput value={search} onChange={handleSearch} placeholder="Пошук голосувань…" />
          </div>

          <ElectionsFiltersButton
            state={filters}
            onChange={updateFilters}
            onReset={resetFilters}
            activeCount={activeFilterCount}
            availableFaculties={meta.faculties}
            availableStudyForms={meta.studyForms}
            statusCounts={statusCounts}
            voteStatusCounts={voteStatusCounts}
            anonymousCounts={anonymousCounts}
            facultyCounts={facultyCounts}
            studyFormCounts={studyFormCounts}
          />

          <Tabs
            tabs={VIEW_TABS}
            activeTab={viewMode}
            onTabChange={handleViewChange}
            className="border-border-color border"
          />
        </div>

        {/* Search — mobile: full-width second row */}
        <div className="sm:hidden">
          <SearchInput value={search} onChange={handleSearch} placeholder="Пошук голосувань…" />
        </div>

        {/* Summary */}
        {hasDifferentFromDefault && filtered.length > 0 && (
          <p className="font-body text-muted-foreground text-xs">
            {search
              ? `Знайдено: ${pluralize(filtered.length, ['голосування', 'голосування', 'голосувань'])}`
              : `${pluralize(filtered.length, ['голосування', 'голосування', 'голосувань'])} з ${elections.length}`}
          </p>
        )}
      </div>

      {/* ── Elections grid / list ───────────────────────────────────────────── */}
      {paged.length === 0 ? (
        <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white">
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title={hasDifferentFromDefault ? 'Голосувань не знайдено' : 'Голосувань поки що немає'}
            description={
              search
                ? `За запитом «${searchTrimmed}» нічого не знайдено`
                : activeFilterCount > 0
                  ? 'Спробуйте змінити або скинути фільтри'
                  : undefined
            }
          />
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {paged.map((election, i) => (
            <ElectionCard
              key={election.id}
              election={election}
              index={(safePage - 1) * ELECTIONS_PAGE_SIZE + i}
            />
          ))}
        </div>
      ) : (
        <div className="border-border-color shadow-shadow-sm overflow-hidden rounded-xl border bg-white">
          {paged.map((election, i) => (
            <ElectionListItem
              key={election.id}
              election={election}
              index={(safePage - 1) * ELECTIONS_PAGE_SIZE + i}
            />
          ))}
        </div>
      )}

      <Pagination page={safePage} totalPages={totalPages} setPage={setPage} />
    </div>
  );
}
