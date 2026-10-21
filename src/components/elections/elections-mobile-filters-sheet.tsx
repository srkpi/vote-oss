'use client';

import type { PanInfo } from 'framer-motion';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  electionsFilterOptionDisabled,
  type ElectionsFilterSection,
  electionsFilterSectionBadge,
  electionsFilterSectionIsActive,
  electionsFilterSectionSummary,
} from '@/components/elections/elections-filter-sections';
import { Button } from '@/components/ui/button';
import { type FilterOption, FiltersResetButton } from '@/components/ui/filters-shell';
import { cn, pluralize } from '@/lib/utils/common';

// A drag past this distance, or a fast-enough flick, dismisses the sheet.
// info.velocity is reported in px/ms, so 0.5 ≈ a brisk flick.
const CLOSE_DISTANCE_PX = 120;
const CLOSE_VELOCITY = 0.5;

interface ElectionsMobileFiltersSheetProps {
  open: boolean;
  onClose: () => void;
  sections: ElectionsFilterSection[];
  activeCount: number;
  onReset: () => void;
  totalCount: number;
}

export function ElectionsMobileFiltersSheet({
  open,
  onClose,
  sections,
  activeCount,
  onReset,
  totalCount,
}: ElectionsMobileFiltersSheetProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const dragControls = useDragControls();

  // Body scroll lock while the sheet is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Land back on the section list next time the sheet opens, once the
  // close animation has had time to finish (avoids a visible jump-cut).
  useEffect(() => {
    if (open) {
      return;
    }
    const t = setTimeout(() => setActiveKey(null), 300);
    return () => clearTimeout(t);
  }, [open]);

  const activeSection = sections.find((s) => s.key === activeKey) ?? null;

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > CLOSE_DISTANCE_PX || info.velocity.y > CLOSE_VELOCITY) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            role="dialog"

            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 1 }}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 340 }}
            className="relative flex max-h-[88dvh] flex-col overflow-hidden rounded-t-2xl bg-card shadow-2xl"
          >
            {/* Handle + header. Only the handle itself starts the drag gesture,
                so the back/close buttons below always receive their taps. */}
            <div className="shrink-0 pt-1">
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="flex touch-none justify-center py-2.5 active:cursor-grabbing"
              >
                <div className="h-1.5 w-10 rounded-full bg-border" />
              </div>

              <div className="px-4 pb-3">
                {activeSection ? (
                  <button
                    type="button"
                    onClick={() => setActiveKey(null)}
                    className="-ml-1.5 flex items-center gap-1 rounded-full py-1.5 pr-3 pl-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {activeSection.title}
                  </button>
                ) : (
                  <h2 className="pl-1.5 font-display text-base font-semibold text-foreground">
                    Фільтри
                  </h2>
                )}
              </div>
            </div>

            {/* Body — its own bounded, scrollable area. Whatever is shown here
                (root list or an option list) is always laid out in normal
                document flow, so it can never render outside the visible sheet. */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <AnimatePresence mode="wait" initial={false}>
                {activeSection ? (
                  <motion.div
                    key={activeSection.key}
                    initial={{ x: 16, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <OptionList section={activeSection} onPicked={() => setActiveKey(null)} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="root"
                    initial={{ x: -16, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="px-2 pb-3"
                  >
                    <div className="divide-y divide-border-subtle">
                      {sections.map((section) => (
                        <SectionRow
                          key={section.key}
                          section={section}
                          onOpen={() => setActiveKey(section.key)}
                        />
                      ))}
                    </div>

                    {activeCount > 0 && (
                      <div className="px-2 pt-3">
                        <FiltersResetButton activeCount={activeCount} onReset={onReset} />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer CTA — always reachable, never dependent on scroll position. */}
            <div className="shrink-0 border-t border-border-subtle px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button variant="primary" fullWidth size="lg" onClick={onClose}>
                Показати {pluralize(totalCount, ['голосування', 'голосування', 'голосувань'])}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── Root-level row ─────────────────────────────────────────────────────────

function SectionRow({ section, onOpen }: { section: ElectionsFilterSection; onOpen: () => void }) {
  const isActive = electionsFilterSectionIsActive(section);
  const summary = electionsFilterSectionSummary(section);
  const badge = electionsFilterSectionBadge(section);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-surface active:bg-surface"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{section.title}</span>
        <span
          className={cn(
            'mt-0.5 block truncate text-xs',
            isActive ? 'font-medium text-kpi-navy' : 'text-muted-foreground',
          )}
        >
          {summary}
        </span>
      </span>
      {badge !== null && (
        <span className="shrink-0 rounded-full bg-kpi-navy/10 px-1.5 py-0.5 text-[10px] font-bold text-kpi-navy tabular-nums">
          {badge}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

// ─── Detail-level option list (single- and multi-select) ──────────────────

function OptionList({
  section,
  onPicked,
}: {
  section: ElectionsFilterSection;
  onPicked: () => void;
}) {
  const [search, setSearch] = useState('');
  const showSearch = section.options.length > 6;
  const filtered = section.options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()),
  );

  const handlePick = (value: string) => {
    if (section.kind === 'single') {
      section.onChange(value);
      onPicked(); // matches the desktop dropdown: choosing a single option closes/returns immediately
      return;
    }
    const next = section.value.includes(value)
      ? section.value.filter((v) => v !== value)
      : [...section.value, value];
    section.onChange(next);
  };

  return (
    <div className="flex flex-col">
      {showSearch && (
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук…"
              className="font-body border-border-color h-10 w-full rounded-lg border bg-surface py-1 pr-9 pl-9 text-sm placeholder:text-subtle focus:border-kpi-blue-light focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">Нічого не знайдено</p>
      ) : (
        <div className="px-2 pb-2">
          {filtered.map((opt) => (
            <OptionRow
              key={opt.value}
              section={section}
              option={opt}
              onPick={() => handlePick(opt.value)}
            />
          ))}
        </div>
      )}

      {section.kind === 'multi' && section.value.length > 0 && (
        <div className="border-t border-border-subtle p-3">
          <button
            type="button"
            onClick={() => section.onChange([])}
            className="font-body w-full rounded-md px-2 py-2 text-center text-xs text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            Скинути вибір
          </button>
        </div>
      )}
    </div>
  );
}

function OptionRow({
  section,
  option,
  onPick,
}: {
  section: ElectionsFilterSection;
  option: FilterOption;
  onPick: () => void;
}) {
  const isSelected =
    section.kind === 'multi'
      ? section.value.includes(option.value)
      : option.value === section.value;
  const isDisabled = electionsFilterOptionDisabled(section, option, isSelected);

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onPick}
      className={cn(
        'font-body flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors',
        isSelected ? 'bg-kpi-navy/5 font-medium text-kpi-navy' : 'text-foreground',
        !isSelected && !isDisabled && 'hover:bg-surface active:bg-surface',
        isDisabled && 'cursor-not-allowed opacity-35',
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        {section.kind === 'multi' ? (
          <span
            className={cn(
              'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition-colors',
              isSelected ? 'border-kpi-navy bg-kpi-navy' : 'border-border-color',
            )}
          >
            {isSelected && <Check className="h-3 w-3 text-white" />}
          </span>
        ) : (
          <span
            className={cn(
              'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border transition-colors',
              isSelected ? 'border-kpi-navy' : 'border-border-color',
            )}
          >
            {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-kpi-navy" />}
          </span>
        )}
        <span className="truncate">{option.label}</span>
      </span>
      <span
        className={cn(
          'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
          isSelected ? 'bg-kpi-navy/10 text-kpi-navy' : 'bg-surface text-muted-foreground',
        )}
      >
        {option.count}
      </span>
    </button>
  );
}
