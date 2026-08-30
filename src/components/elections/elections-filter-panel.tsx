'use client';

import { ChevronDown, Filter } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  buildElectionsFilterSections,
  type ElectionsFilterSectionsInput,
} from '@/components/elections/elections-filter-sections';
import { ElectionsMobileFiltersSheet } from '@/components/elections/elections-mobile-filters-sheet';
import {
  FilterDropdown,
  FilterMultiDropdown,
  FilterSectionTitle,
  FiltersResetButton,
} from '@/components/ui/filters-shell';
import { cn } from '@/lib/utils/common';

// ─── Desktop popover content ────────────────────────────────────────────────
//
// Unchanged interaction model: one dropdown per filter, opening as a small
// floating menu right under its own trigger. This isn't what was reported
// broken, so it keeps behaving exactly as it does today — it now just reads
// its option lists from the same builder the mobile sheet uses, instead of
// hand-rolling a second copy of them.

interface DesktopContentProps extends ElectionsFilterSectionsInput {
  activeCount: number;
  onReset: () => void;
}

function ElectionsFiltersContent(props: DesktopContentProps) {
  const sections = buildElectionsFilterSections(props);

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.key}>
          <FilterSectionTitle>{section.title}</FilterSectionTitle>
          {section.kind === 'multi' ? (
            <FilterMultiDropdown
              label={section.placeholder}
              options={section.options}
              value={section.value}
              onChange={section.onChange}
            />
          ) : (
            <FilterDropdown
              label={section.placeholder}
              options={section.options}
              value={section.value}
              onChange={section.onChange}
            />
          )}
        </div>
      ))}

      <FiltersResetButton activeCount={props.activeCount} onReset={props.onReset} />
    </div>
  );
}

// ─── Public trigger button ──────────────────────────────────────────────────
//
// Desktop (>= 640px): trigger + floating popover, same as before.
// Mobile   (< 640px):  trigger + the reworked ElectionsMobileFiltersSheet.
//
// This mirrors filters-shell.tsx's own trigger/isMobile-dispatch pattern
// rather than reusing it directly, so the fix stays scoped to the Elections
// filters and doesn't touch the shared shell that Registration and Groups
// also render through.

interface FiltersButtonProps extends DesktopContentProps {
  className?: string;
}

function useIsMobile(breakpointPx = 640) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpointPx);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpointPx]);

  return isMobile;
}

export function ElectionsFiltersButton({
  className,
  activeCount,
  onReset,
  ...sectionsInput
}: FiltersButtonProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);

  // Desktop only: close the popover on an outside click. The trigger button
  // lives inside this same ref, so clicking it again to close never races
  // against this listener.
  useEffect(() => {
    if (isMobile || !open) return;
    const onPointer = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [isMobile, open]);

  const sections = buildElectionsFilterSections(sectionsInput);

  // voteStatusCounts[state.voteStatus] is the adaptive count for whichever
  // vote-status option is currently active — since that's a no-op override
  // on top of the already-applied filters, it equals the true total number
  // of elections the current filter combination matches.
  const totalCount = sectionsInput.voteStatusCounts[sectionsInput.state.voteStatus] ?? 0;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
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

      {!isMobile && open && (
        <div className="border-border-color animate-scale-in absolute top-full right-0 z-40 mt-2 w-80 rounded-2xl border bg-white p-5 shadow-xl">
          <ElectionsFiltersContent {...sectionsInput} activeCount={activeCount} onReset={onReset} />
        </div>
      )}

      <ElectionsMobileFiltersSheet
        open={isMobile && open}
        onClose={() => setOpen(false)}
        sections={sections}
        activeCount={activeCount}
        onReset={onReset}
        totalCount={totalCount}
      />
    </div>
  );
}
