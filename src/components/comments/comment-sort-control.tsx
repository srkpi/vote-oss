'use client';

import { ArrowDownWideNarrow, ArrowUpWideNarrow, Clock, ThumbsUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/common';
import type { CommentSort, CommentSortDirection } from '@/types/comment';

const FIELD_OPTIONS = [
  { value: 'date' as const, label: 'За датою', Icon: Clock },
  { value: 'rating' as const, label: 'За рейтингом', Icon: ThumbsUp },
] as const;

// The direction someone almost always means when they first switch to a
// field: oldest-first for a running discussion, best-first for a ranking.
// The toggle button can still flip away from this once a field is picked.
const FIELD_DEFAULT_DIRECTION: Record<CommentSort, CommentSortDirection> = {
  date: 'asc',
  rating: 'desc',
};

const DIRECTION_LABEL: Record<CommentSort, Record<CommentSortDirection, string>> = {
  date: { asc: 'Спочатку старі', desc: 'Спочатку нові' },
  rating: { asc: 'Спочатку з нижчим рейтингом', desc: 'Спочатку з вищим рейтингом' },
};

interface CommentSortControlProps {
  sort: CommentSort;
  direction: CommentSortDirection;
  onChange: (sort: CommentSort, direction: CommentSortDirection) => void;
  disabled?: boolean;
}

export function CommentSortControl({
  sort,
  direction,
  onChange,
  disabled = false,
}: CommentSortControlProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { label, Icon: CurrentIcon } = FIELD_OPTIONS.find((o) => o.value === sort)!;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div className="flex items-center gap-1.5">
      <div ref={ref} className="relative">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          disabled={disabled}
          className="gap-1.5"
        >
          <CurrentIcon className="h-3.5 w-3.5" />
          {label}
        </Button>

        {open && (
          <div className="border-border-color absolute top-full right-0 z-10 mt-1.5 min-w-44 overflow-hidden rounded-lg border bg-white py-1 shadow-sm">
            {FIELD_OPTIONS.map(({ value, label: optionLabel, Icon }) => {
              const selected = sort === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (selected) return;
                    onChange(value, FIELD_DEFAULT_DIRECTION[value]);
                  }}
                  className={cn(
                    'font-body flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                    selected
                      ? 'text-kpi-navy font-semibold'
                      : 'text-foreground hover:bg-surface font-medium',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      selected ? 'text-kpi-navy' : 'text-muted-foreground',
                    )}
                  />
                  {optionLabel}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        onClick={() => onChange(sort, direction === 'asc' ? 'desc' : 'asc')}
        disabled={disabled}
        title={DIRECTION_LABEL[sort][direction]}
      >
        {direction === 'asc' ? (
          <ArrowUpWideNarrow className="h-3.5 w-3.5" />
        ) : (
          <ArrowDownWideNarrow className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}
