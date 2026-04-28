'use client';

import {
  FilterDropdown,
  FilterMultiDropdown,
  type FilterOption,
  FiltersButton,
  FilterSectionTitle,
  FiltersResetButton,
} from '@/components/ui/filters-shell';

export type RegistrationStatusFilter = 'open' | 'upcoming' | 'closed';
export type RegistrationEligibilityFilter = 'all' | 'eligible' | 'ineligible';

export interface RegistrationFilterState {
  statuses: RegistrationStatusFilter[];
  eligibility: RegistrationEligibilityFilter;
}

interface FiltersPanelProps {
  state: RegistrationFilterState;
  onChange: (next: Partial<RegistrationFilterState>) => void;
  onReset: () => void;
  activeCount: number;
  statusCounts: Record<string, number>;
  eligibilityCounts: Record<string, number>;
}

function RegistrationFiltersContent({
  state,
  onChange,
  onReset,
  activeCount,
  statusCounts,
  eligibilityCounts,
}: FiltersPanelProps) {
  const statusOptions: FilterOption<RegistrationStatusFilter>[] = [
    { value: 'open', label: 'Відкриті', count: statusCounts['open'] ?? 0 },
    { value: 'upcoming', label: 'Заплановані', count: statusCounts['upcoming'] ?? 0 },
    { value: 'closed', label: 'Завершені', count: statusCounts['closed'] ?? 0 },
  ];

  const eligibilityOptions: FilterOption<RegistrationEligibilityFilter>[] = [
    { value: 'all', label: 'Усі', count: eligibilityCounts['all'] ?? 0 },
    { value: 'eligible', label: 'Доступні', count: eligibilityCounts['eligible'] ?? 0 },
    { value: 'ineligible', label: 'Недоступні', count: eligibilityCounts['ineligible'] ?? 0 },
  ];

  return (
    <div className="space-y-4">
      <div>
        <FilterSectionTitle>Статус</FilterSectionTitle>
        <FilterMultiDropdown
          label="Всі статуси"
          options={statusOptions}
          value={state.statuses}
          onChange={(v) => onChange({ statuses: v as RegistrationStatusFilter[] })}
        />
      </div>

      <div>
        <FilterSectionTitle>Доступ</FilterSectionTitle>
        <FilterDropdown
          label="Усі"
          options={eligibilityOptions}
          value={state.eligibility}
          onChange={(v) => onChange({ eligibility: v })}
        />
      </div>

      <FiltersResetButton activeCount={activeCount} onReset={onReset} />
    </div>
  );
}

interface FiltersButtonProps extends FiltersPanelProps {
  className?: string;
}

export function RegistrationFiltersButton({
  className,
  activeCount,
  ...panelProps
}: FiltersButtonProps) {
  return (
    <FiltersButton activeCount={activeCount} className={className}>
      <RegistrationFiltersContent activeCount={activeCount} {...panelProps} />
    </FiltersButton>
  );
}
