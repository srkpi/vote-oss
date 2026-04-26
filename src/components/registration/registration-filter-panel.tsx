'use client';

import { ChevronDown, Filter, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  FilterDropdown,
  FilterMultiDropdown,
  type FilterOption,
} from '@/components/elections/elections-filter-panel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/common';

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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-body mb-2 text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
      {children}
    </p>
  );
}

function FilterPanelContent({
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
        <SectionTitle>Статус</SectionTitle>
        <FilterMultiDropdown
          label="Всі статуси"
          options={statusOptions}
          value={state.statuses}
          onChange={(v) => onChange({ statuses: v as RegistrationStatusFilter[] })}
        />
      </div>

      <div>
        <SectionTitle>Доступ</SectionTitle>
        <FilterDropdown
          label="Усі"
          options={eligibilityOptions}
          value={state.eligibility}
          onChange={(v) => onChange({ eligibility: v })}
        />
      </div>

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

interface FiltersButtonProps extends FiltersPanelProps {
  className?: string;
}

export function RegistrationFiltersButton({
  className,
  activeCount,
  ...panelProps
}: FiltersButtonProps) {
  const [open, setOpen] = useState(false);
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
