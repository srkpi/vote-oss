'use client';

import { Check, ChevronDown, Filter, RotateCcw, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { ElectionsFilterState } from '@/components/elections/elections-filter';
import { Button } from '@/components/ui/button';
import { STUDY_FORM_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils/common';

// Kept as a named export for external consumers
export type StatusTabKey = 'all' | 'open' | 'upcoming' | 'closed';

// ─── Shared option type ───────────────────────────────────────────────────────

export interface FilterOption<T extends string = string> {
  value: T;
  label: string;
  count: number;
}

// ─── Panel props ──────────────────────────────────────────────────────────────

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

// ─── Single-select dropdown with per-option counts ────────────────────────────

function FilterDropdown<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: FilterOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);
  const isFiltered = value !== options[0]?.value;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'font-body flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-150',
          isFiltered
            ? 'border-kpi-navy bg-kpi-navy/5 text-kpi-navy'
            : 'border-border-color text-foreground hover:border-kpi-blue-light/50 bg-white',
          open && !isFiltered && 'border-kpi-blue-light',
        )}
      >
        <span className="flex-1 truncate text-left">{selected?.label ?? label}</span>
        {isFiltered && (
          <span className="bg-kpi-navy/10 text-kpi-navy shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
            {selected?.count}
          </span>
        )}
        <ChevronDown
          className={cn(
            'text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="border-border-color shadow-shadow-lg absolute top-full left-0 z-200 mt-1 min-w-52.5 overflow-hidden rounded-lg border bg-white">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            const isDisabled = opt.count === 0 && opt.value !== options[0]?.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  'font-body flex w-full items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors duration-75',
                  isSelected ? 'bg-kpi-navy/5 text-kpi-navy font-semibold' : 'text-foreground',
                  !isSelected && !isDisabled && 'hover:bg-surface',
                  isDisabled && 'cursor-not-allowed opacity-35',
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                    {isSelected && <Check className="text-kpi-navy h-3.5 w-3.5" />}
                  </span>
                  {opt.label}
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                    isSelected
                      ? 'bg-kpi-navy/10 text-kpi-navy'
                      : 'bg-surface text-muted-foreground',
                  )}
                >
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Multi-select dropdown with optional search + counts ─────────────────────

export function FilterMultiDropdown({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const showSearch = options.length > 6;
  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));
  const isFiltered = value.length > 0;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  useEffect(() => {
    if (open && showSearch) {
      const t = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open, showSearch]);

  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  const triggerLabel = isFiltered
    ? options
        .filter((o) => value.includes(o.value))
        .map((o) => o.label)
        .join(', ')
    : label;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'font-body flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-150',
          isFiltered
            ? 'border-kpi-navy bg-kpi-navy/5 text-kpi-navy'
            : 'border-border-color text-foreground hover:border-kpi-blue-light/50 bg-white',
          open && !isFiltered && 'border-kpi-blue-light',
        )}
      >
        <span className="flex-1 truncate text-left">{triggerLabel}</span>
        {isFiltered && (
          <span className="bg-kpi-navy flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white">
            {value.length}
          </span>
        )}
        <ChevronDown
          className={cn(
            'text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="border-border-color shadow-shadow-lg absolute top-full left-0 z-200 mt-1 w-72 overflow-hidden rounded-lg border bg-white">
          {showSearch && (
            <div className="border-border-subtle border-b p-2">
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Пошук…"
                  className="font-body bg-surface text-foreground placeholder:text-subtle focus:border-kpi-blue-light h-8 w-full rounded-md border border-transparent py-1 pr-8 pl-8 text-sm focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setSearch('')}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-muted-foreground px-3 py-6 text-center text-sm">
                Нічого не знайдено
              </p>
            ) : (
              filtered.map((opt) => {
                const isSelected = value.includes(opt.value);
                // Never disable already-selected options; disable only 0-count unselected ones
                const isDisabled = !isSelected && opt.count === 0;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => toggle(opt.value)}
                    className={cn(
                      'font-body flex w-full items-center justify-between gap-2 px-3 py-2 text-sm transition-colors duration-75',
                      isSelected ? 'bg-kpi-navy/5 text-kpi-navy font-medium' : 'text-foreground',
                      !isSelected && !isDisabled && 'hover:bg-surface',
                      isDisabled && 'cursor-not-allowed opacity-35',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <div
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                          isSelected ? 'border-kpi-navy bg-kpi-navy' : 'border-border-color',
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <span className="truncate">{opt.label}</span>
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                        isSelected
                          ? 'bg-kpi-navy/10 text-kpi-navy'
                          : 'bg-surface text-muted-foreground',
                      )}
                    >
                      {opt.count}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {value.length > 0 && (
            <div className="border-border-subtle border-t p-2">
              <button
                type="button"
                onClick={() => onChange([])}
                className="font-body text-muted-foreground hover:text-foreground hover:bg-surface w-full rounded-md px-2 py-1.5 text-xs transition-colors"
              >
                Скинути вибір
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section title ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-body mb-2 text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
      {children}
    </p>
  );
}

// ─── Panel content (shared by desktop popover + mobile sheet) ─────────────────

function FilterPanelContent({
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
        <SectionTitle>Статус</SectionTitle>
        <FilterMultiDropdown
          label="Всі статуси"
          options={statusOptions}
          value={state.statuses}
          onChange={(v) => onChange({ statuses: v as ElectionsFilterState['statuses'] })}
        />
      </div>

      <div>
        <SectionTitle>Участь</SectionTitle>
        <FilterDropdown
          label="Усі"
          options={voteStatusOptions}
          value={state.voteStatus}
          onChange={(v) => onChange({ voteStatus: v })}
        />
      </div>

      <div>
        <SectionTitle>Конфіденційність</SectionTitle>
        <FilterDropdown
          label="Усі"
          options={anonymousOptions}
          value={state.anonymous}
          onChange={(v) => onChange({ anonymous: v })}
        />
      </div>

      {availableFaculties.length > 0 && (
        <div>
          <SectionTitle>Підрозділ</SectionTitle>
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
          <SectionTitle>Форма навчання</SectionTitle>
          <FilterMultiDropdown
            label="Всі форми"
            options={studyFormOptions}
            value={state.studyForms}
            onChange={(v) => onChange({ studyForms: v })}
          />
        </div>
      )}

      {activeCount > 0 && (
        <button
          type="button"
          onClick={onReset}
          className="font-body text-error flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-100 bg-red-50 py-2 text-xs font-medium transition-colors hover:bg-red-100"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Скинути фільтри ({activeCount})
        </button>
      )}
    </div>
  );
}

// ─── Mobile bottom-sheet ──────────────────────────────────────────────────────

function MobileFiltersSheet({
  open,
  onClose,
  activeCount,
  ...panelProps
}: FiltersPanelProps & { open: boolean; onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* stopPropagation prevents backdrop from receiving taps on sheet content */}
      <div
        className="relative flex max-h-[88dvh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-3">
          <div className="absolute top-2.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-200" />
          <h2 className="font-display text-foreground text-base font-semibold">Фільтри</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-surface flex h-8 w-8 items-center justify-center rounded-full transition-colors"
            aria-label="Закрити"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-4">
          <FilterPanelContent activeCount={activeCount} {...panelProps} />
        </div>
        <div className="border-border-subtle shrink-0 border-t px-5 py-4">
          <Button variant="primary" fullWidth size="lg" onClick={onClose}>
            Показати результати
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Desktop popover — no "Фільтри" header ───────────────────────────────────

function DesktopFiltersPopover({
  open,
  onClose,
  activeCount,
  ...panelProps
}: FiltersPanelProps & { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="border-border-color shadow-shadow-xl animate-scale-in absolute top-full right-0 z-40 mt-2 w-80 rounded-2xl border bg-white p-5"
    >
      <FilterPanelContent activeCount={activeCount} {...panelProps} />
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
  const [open, setOpen] = useState(false);
  // JS-driven mobile detection — prevents the desktop popover's pointerdown
  // listener from firing on mobile and closing the sheet on every tap.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'font-body inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-all duration-150',
          activeCount > 0
            ? 'border-kpi-navy bg-kpi-navy/5 text-kpi-navy shadow-sm'
            : 'border-border-color text-foreground hover:border-kpi-blue-light/50 bg-white',
        )}
      >
        <Filter className="h-3.5 w-3.5" />
        <span>Фільтри</span>
        {activeCount > 0 && (
          <span className="bg-kpi-navy flex h-4.5 w-4.5 items-center justify-center rounded-full text-[10px] font-bold text-white">
            {activeCount}
          </span>
        )}
        <ChevronDown
          className={cn(
            'text-muted-foreground hidden h-3.5 w-3.5 transition-transform duration-150 sm:block',
            open && 'rotate-180',
          )}
        />
      </button>

      {isMobile ? (
        <MobileFiltersSheet
          open={open}
          onClose={() => setOpen(false)}
          activeCount={activeCount}
          {...panelProps}
        />
      ) : (
        <DesktopFiltersPopover
          open={open}
          onClose={() => setOpen(false)}
          activeCount={activeCount}
          {...panelProps}
        />
      )}
    </div>
  );
}
