import type { ElectionsFilterState } from '@/components/elections/elections-filter';
import type { FilterOption } from '@/components/ui/filters-shell';
import { STUDY_FORM_LABELS } from '@/lib/constants';

// ─── Shared filter-section model ───────────────────────────────────────────
//
// Both the desktop popover (one dropdown per row) and the mobile sheet
// (drill-down list) render from this same declarative shape. Neither
// surface hand-rolls its own copy of the option lists, so they can't drift
// out of sync with each other or with the underlying `ElectionsFilterState`.

interface ElectionsFilterSectionBase {
  key: string;
  title: string;
  /** Shown as the row summary / trigger label when nothing is selected. */
  placeholder: string;
}

export type ElectionsFilterSection =
  | (ElectionsFilterSectionBase & {
      kind: 'single';
      options: FilterOption[];
      value: string;
      onChange: (value: string) => void;
    })
  | (ElectionsFilterSectionBase & {
      kind: 'multi';
      options: FilterOption[];
      value: string[];
      onChange: (value: string[]) => void;
    });

export interface ElectionsFilterSectionsInput {
  state: ElectionsFilterState;
  onChange: (next: Partial<ElectionsFilterState>) => void;
  availableFaculties: string[];
  availableStudyForms: string[];
  // Adaptive counts — computed in elections-filter.tsx.
  // For a SELECTED option the count equals the current result set size.
  // For an UNSELECTED option the count shows what you'd see if you selected it.
  statusCounts: Record<string, number>;
  voteStatusCounts: Record<string, number>;
  anonymousCounts: Record<string, number>;
  facultyCounts: Record<string, number>;
  studyFormCounts: Record<string, number>;
}

export function buildElectionsFilterSections({
  state,
  onChange,
  availableFaculties,
  availableStudyForms,
  statusCounts,
  voteStatusCounts,
  anonymousCounts,
  facultyCounts,
  studyFormCounts,
}: ElectionsFilterSectionsInput): ElectionsFilterSection[] {
  const sections: ElectionsFilterSection[] = [
    {
      key: 'statuses',
      title: 'Статус',
      placeholder: 'Всі статуси',
      kind: 'multi',
      options: [
        { value: 'open', label: 'Активні', count: statusCounts['open'] ?? 0 },
        { value: 'upcoming', label: 'Майбутні', count: statusCounts['upcoming'] ?? 0 },
        { value: 'closed', label: 'Завершені', count: statusCounts['closed'] ?? 0 },
      ],
      value: state.statuses,
      // Safe: options above are always valid ElectionsFilterState['statuses'] members.
      onChange: (v) => onChange({ statuses: v as ElectionsFilterState['statuses'] }),
    },
    {
      key: 'voteStatus',
      title: 'Участь',
      placeholder: 'Усі',
      kind: 'single',
      options: [
        { value: 'all', label: 'Усі', count: voteStatusCounts['all'] ?? 0 },
        { value: 'available', label: 'Доступні', count: voteStatusCounts['available'] ?? 0 },
        { value: 'cannot_vote', label: 'Не доступне', count: voteStatusCounts['cannot_vote'] ?? 0 },
      ],
      value: state.voteStatus,
      onChange: (v) => onChange({ voteStatus: v as ElectionsFilterState['voteStatus'] }),
    },
    {
      key: 'anonymous',
      title: 'Конфіденційність',
      placeholder: 'Усі',
      kind: 'single',
      options: [
        { value: 'all', label: 'Усі', count: anonymousCounts['all'] ?? 0 },
        { value: 'anonymous', label: 'Анонімні', count: anonymousCounts['anonymous'] ?? 0 },
        {
          value: 'non_anonymous',
          label: 'Неанонімні',
          count: anonymousCounts['non_anonymous'] ?? 0,
        },
      ],
      value: state.anonymous,
      onChange: (v) => onChange({ anonymous: v as ElectionsFilterState['anonymous'] }),
    },
  ];

  if (availableFaculties.length > 0) {
    sections.push({
      key: 'faculties',
      title: 'Підрозділ',
      placeholder: 'Всі підрозділи',
      kind: 'multi',
      options: availableFaculties.map((f) => ({
        value: f,
        label: f,
        count: facultyCounts[f] ?? 0,
      })),
      value: state.faculties,
      onChange: (v) => onChange({ faculties: v }),
    });
  }

  if (availableStudyForms.length > 0) {
    sections.push({
      key: 'studyForms',
      title: 'Форма навчання',
      placeholder: 'Всі форми',
      kind: 'multi',
      options: availableStudyForms.map((sf) => ({
        value: sf,
        label: STUDY_FORM_LABELS[sf as keyof typeof STUDY_FORM_LABELS] ?? sf,
        count: studyFormCounts[sf] ?? 0,
      })),
      value: state.studyForms,
      onChange: (v) => onChange({ studyForms: v }),
    });
  }

  return sections;
}

// ─── Small per-section helpers shared by row summaries ────────────────────
//
// Mirrors the exact semantics of the original FilterDropdown / FilterMultiDropdown
// trigger buttons: a multi-select badge counts *selected options*, while a
// single-select badge shows the *result count* for whichever option is active
// (showing "1" there would be meaningless — every single-select always has
// exactly one active choice).

export function electionsFilterSectionSummary(section: ElectionsFilterSection): string {
  if (section.kind === 'multi') {
    if (section.value.length === 0) return section.placeholder;
    return section.options
      .filter((o) => section.value.includes(o.value))
      .map((o) => o.label)
      .join(', ');
  }
  return section.options.find((o) => o.value === section.value)?.label ?? section.placeholder;
}

export function electionsFilterSectionIsActive(section: ElectionsFilterSection): boolean {
  if (section.kind === 'multi') return section.value.length > 0;
  return section.value !== section.options[0]?.value;
}

export function electionsFilterSectionBadge(section: ElectionsFilterSection): number | null {
  if (section.kind === 'multi') {
    return section.value.length > 0 ? section.value.length : null;
  }
  if (section.value === section.options[0]?.value) return null;
  return section.options.find((o) => o.value === section.value)?.count ?? null;
}

/** Matches FilterDropdown/FilterMultiDropdown's own disabled-option rule exactly. */
export function electionsFilterOptionDisabled(
  section: ElectionsFilterSection,
  option: FilterOption,
  isSelected: boolean,
): boolean {
  if (section.kind === 'single') {
    return option.count === 0 && option.value !== section.options[0]?.value;
  }
  return !isSelected && option.count === 0;
}
