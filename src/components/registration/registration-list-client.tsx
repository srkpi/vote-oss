'use client';

import { ClipboardList, LayoutGrid, LayoutList } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import {
  RegistrationCard,
  RegistrationCardSkeleton,
  type RegistrationFormStatus,
  type RegistrationFormWithEligibility,
} from '@/components/registration/registration-card';
import {
  RegistrationFiltersButton,
  type RegistrationFilterState,
} from '@/components/registration/registration-filter-panel';
import { RegistrationListItem } from '@/components/registration/registration-list-item';
import { Alert } from '@/components/ui/alert';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Tabs } from '@/components/ui/tabs';
import { LOCAL_STORAGE_REGISTRATION_VIEW_KEY, REGISTRATION_FORMS_PAGE_SIZE } from '@/lib/constants';
import { pluralize } from '@/lib/utils/common';

interface RegistrationListClientProps {
  initialForms: RegistrationFormWithEligibility[];
  error: string | null;
}

type ViewMode = 'grid' | 'list';

const VIEW_TABS: { key: ViewMode; icon: React.ReactNode }[] = [
  { key: 'grid', icon: <LayoutGrid className="h-4 w-4" /> },
  { key: 'list', icon: <LayoutList className="h-4 w-4" /> },
];

const DEFAULT_FILTER_STATE: RegistrationFilterState = {
  statuses: [],
  eligibility: 'eligible',
};

function statusOf(form: RegistrationFormWithEligibility): RegistrationFormStatus {
  const now = Date.now();
  if (now < new Date(form.opensAt).getTime()) return 'upcoming';
  if (now > new Date(form.closesAt).getTime()) return 'closed';
  return 'open';
}

function countActiveFilters(state: RegistrationFilterState): number {
  let count = 0;
  if (state.statuses.length > 0) count++;
  if (state.eligibility !== DEFAULT_FILTER_STATE.eligibility) count++;
  return count;
}

function matchesFilters(
  form: RegistrationFormWithEligibility,
  status: RegistrationFormStatus,
  filters: RegistrationFilterState,
): boolean {
  if (filters.statuses.length > 0 && !filters.statuses.includes(status)) return false;
  if (filters.eligibility === 'eligible' && !form.eligible) return false;
  if (filters.eligibility === 'ineligible' && form.eligible) return false;
  return true;
}

function matchesSearch(form: RegistrationFormWithEligibility, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return form.title.toLowerCase().includes(q) || form.groupName.toLowerCase().includes(q);
}

function computeAdaptiveCount(
  forms: RegistrationFormWithEligibility[],
  filters: RegistrationFilterState,
  search: string,
  overrides: Partial<RegistrationFilterState>,
): number {
  return forms.filter(
    (f) => matchesFilters(f, statusOf(f), { ...filters, ...overrides }) && matchesSearch(f, search),
  ).length;
}

export function RegistrationListClient({ initialForms, error }: RegistrationListClientProps) {
  const forms = initialForms;

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<RegistrationFilterState>(DEFAULT_FILTER_STATE);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [page, setPage] = useState(1);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_REGISTRATION_VIEW_KEY);
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
      localStorage.setItem(LOCAL_STORAGE_REGISTRATION_VIEW_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  const updateFilters = useCallback((next: Partial<RegistrationFilterState>) => {
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

  const statusCounts = useMemo(() => {
    return Object.fromEntries(
      (['open', 'upcoming', 'closed'] as const).map((s) => {
        const newStatuses = filters.statuses.includes(s)
          ? filters.statuses
          : [...filters.statuses, s];
        return [s, computeAdaptiveCount(forms, filters, search, { statuses: newStatuses })];
      }),
    );
  }, [forms, filters, search]);

  const eligibilityCounts = useMemo(() => {
    return Object.fromEntries(
      (['all', 'eligible', 'ineligible'] as const).map((opt) => [
        opt,
        computeAdaptiveCount(forms, filters, search, { eligibility: opt }),
      ]),
    );
  }, [forms, filters, search]);

  const filtered = useMemo(
    () =>
      forms
        .map((f) => ({ form: f, status: statusOf(f) }))
        .filter(
          ({ form, status }) =>
            matchesFilters(form, status, filters) && matchesSearch(form, search),
        ),
    [forms, filters, search],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / REGISTRATION_FORMS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (safePage - 1) * REGISTRATION_FORMS_PAGE_SIZE,
    safePage * REGISTRATION_FORMS_PAGE_SIZE,
  );

  const hasDifferentFromDefault = activeFilterCount > 0 || !!search;
  const searchTrimmed = search.length > 80 ? search.slice(0, 80) + '…' : search;

  return (
    <>
      <PageHeader
        title="Реєстрація кандидатів"
        description="Перелік форм, відкритих для подачі заявок"
        isContainer
      />
      <div className="container py-8">
        {error && (
          <Alert variant="error" title="Помилка завантаження" className="mb-6">
            {error}
          </Alert>
        )}

        {!error && forms.length === 0 ? (
          <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white">
            <EmptyState
              icon={<ClipboardList className="h-8 w-8" />}
              title="Зараз немає відкритих форм"
              description="ВКСУ ще не публікувала форм реєстрації для виборних органів"
            />
          </div>
        ) : !hydrated ? (
          <div className="space-y-6">
            <div className="flex gap-3">
              <div className="skeleton h-9 w-64 rounded-lg" />
              <div className="skeleton h-9 w-24 rounded-lg" />
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <RegistrationCardSkeleton key={i} index={i} />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="hidden flex-1 sm:block">
                  <SearchInput value={search} onChange={handleSearch} placeholder="Пошук форм…" />
                </div>

                <RegistrationFiltersButton
                  state={filters}
                  onChange={updateFilters}
                  onReset={resetFilters}
                  activeCount={activeFilterCount}
                  statusCounts={statusCounts}
                  eligibilityCounts={eligibilityCounts}
                />

                <Tabs
                  tabs={VIEW_TABS}
                  activeTab={viewMode}
                  onTabChange={handleViewChange}
                  className="border-border-color border"
                />
              </div>

              <div className="sm:hidden">
                <SearchInput value={search} onChange={handleSearch} placeholder="Пошук форм…" />
              </div>

              {hasDifferentFromDefault && filtered.length > 0 && (
                <p className="font-body text-muted-foreground text-xs">
                  {search
                    ? `Знайдено: ${pluralize(filtered.length, ['форму', 'форми', 'форм'])}`
                    : `${pluralize(filtered.length, ['форма', 'форми', 'форм'])} з ${forms.length}`}
                </p>
              )}
            </div>

            {paged.length === 0 ? (
              <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white">
                <EmptyState
                  icon={<ClipboardList className="h-8 w-8" />}
                  title={hasDifferentFromDefault ? 'Форм не знайдено' : 'Форм поки що немає'}
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
                {paged.map(({ form, status }, i) => (
                  <RegistrationCard
                    key={form.id}
                    form={form}
                    status={status}
                    index={(safePage - 1) * REGISTRATION_FORMS_PAGE_SIZE + i}
                  />
                ))}
              </div>
            ) : (
              <div className="border-border-color shadow-shadow-sm overflow-hidden rounded-xl border bg-white">
                {paged.map(({ form, status }, i) => (
                  <RegistrationListItem
                    key={form.id}
                    form={form}
                    status={status}
                    index={(safePage - 1) * REGISTRATION_FORMS_PAGE_SIZE + i}
                  />
                ))}
              </div>
            )}

            <Pagination page={safePage} totalPages={totalPages} setPage={setPage} />
          </div>
        )}
      </div>
    </>
  );
}
