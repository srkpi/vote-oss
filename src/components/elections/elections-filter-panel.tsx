'use client';

import type { ElectionsFilterState } from '@/components/elections/elections-filter';
import {
  FilterDropdown,
  FilterMultiDropdown,
  type FilterOption,
  FiltersButton,
  FilterSectionTitle,
  FiltersResetButton,
} from '@/components/ui/filters-shell';
import { STUDY_FORM_LABELS } from '@/lib/constants';

// ─── Panel content ────────────────────────────────────────────────────────────

interface FiltersPanelProps {
  state: ElectionsFilterState;
  onChange: (next: Partial<ElectionsFilterState>) => void;
  onReset: () => void;
  activeCount: number;
  availableFaculties: string[];
  availableStudyForms: string[];
  // Adaptive counts — computed in elections-filter.tsx
  // For a SELECTED option the count equals the current result set size.
  // For an UNSELECTED option the count shows what you'd see if you selected it.
  statusCounts: Record<string, number>;
  voteStatusCounts: Record<string, number>;
  anonymousCounts: Record<string, number>;
  facultyCounts: Record<string, number>;
  studyFormCounts: Record<string, number>;
  className?: string;
}

function ElectionsFiltersContent({
  state,
  onChange,
  onReset,
  activeCount,
  availableFaculties,
  availableStudyForms,
  statusCounts,
  voteStatusCounts,
  anonymousCounts,
  facultyCounts,
  studyFormCounts,
}: FiltersPanelProps) {
  const statusOptions: FilterOption<'open' | 'upcoming' | 'closed'>[] = [
    { value: 'open', label: 'Активні', count: statusCounts['open'] ?? 0 },
    { value: 'upcoming', label: 'Майбутні', count: statusCounts['upcoming'] ?? 0 },
    { value: 'closed', label: 'Завершені', count: statusCounts['closed'] ?? 0 },
  ];

  const voteStatusOptions: FilterOption<ElectionsFilterState['voteStatus']>[] = [
    { value: 'all', label: 'Усі', count: voteStatusCounts['all'] ?? 0 },
    { value: 'available', label: 'Доступні', count: voteStatusCounts['available'] ?? 0 },
    { value: 'cannot_vote', label: 'Не доступне', count: voteStatusCounts['cannot_vote'] ?? 0 },
  ];

  const anonymousOptions: FilterOption<ElectionsFilterState['anonymous']>[] = [
    { value: 'all', label: 'Усі', count: anonymousCounts['all'] ?? 0 },
    { value: 'anonymous', label: 'Анонімні', count: anonymousCounts['anonymous'] ?? 0 },
    { value: 'non_anonymous', label: 'Неанонімні', count: anonymousCounts['non_anonymous'] ?? 0 },
  ];

  const facultyOptions: FilterOption[] = availableFaculties.map((f) => ({
    value: f,
    label: f,
    count: facultyCounts[f] ?? 0,
  }));

  const studyFormOptions: FilterOption[] = availableStudyForms.map((sf) => ({
    value: sf,
    label: STUDY_FORM_LABELS[sf as keyof typeof STUDY_FORM_LABELS] ?? sf,
    count: studyFormCounts[sf] ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div>
        <FilterSectionTitle>Статус</FilterSectionTitle>
        <FilterMultiDropdown
          label="Всі статуси"
          options={statusOptions}
          value={state.statuses}
          onChange={(v) => onChange({ statuses: v as ElectionsFilterState['statuses'] })}
        />
      </div>

      <div>
        <FilterSectionTitle>Участь</FilterSectionTitle>
        <FilterDropdown
          label="Усі"
          options={voteStatusOptions}
          value={state.voteStatus}
          onChange={(v) => onChange({ voteStatus: v })}
        />
      </div>

      <div>
        <FilterSectionTitle>Конфіденційність</FilterSectionTitle>
        <FilterDropdown
          label="Усі"
          options={anonymousOptions}
          value={state.anonymous}
          onChange={(v) => onChange({ anonymous: v })}
        />
      </div>

      {availableFaculties.length > 0 && (
        <div>
          <FilterSectionTitle>Підрозділ</FilterSectionTitle>
          <FilterMultiDropdown
            label="Всі підрозділи"
            options={facultyOptions}
            value={state.faculties}
            onChange={(v) => onChange({ faculties: v })}
          />
        </div>
      )}

      {availableStudyForms.length > 0 && (
        <div>
          <FilterSectionTitle>Форма навчання</FilterSectionTitle>
          <FilterMultiDropdown
            label="Всі форми"
            options={studyFormOptions}
            value={state.studyForms}
            onChange={(v) => onChange({ studyForms: v })}
          />
        </div>
      )}

      <FiltersResetButton activeCount={activeCount} onReset={onReset} />
    </div>
  );
}

// ─── Public trigger button ────────────────────────────────────────────────────

interface FiltersButtonProps extends FiltersPanelProps {
  className?: string;
}

export function ElectionsFiltersButton({
  className,
  activeCount,
  ...panelProps
}: FiltersButtonProps) {
  return (
    <FiltersButton activeCount={activeCount} className={className}>
      <ElectionsFiltersContent activeCount={activeCount} {...panelProps} />
    </FiltersButton>
  );
}
