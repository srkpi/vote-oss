'use client';

import { ArrowDownAZ, ArrowDownWideNarrow, List } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/common';

export type ChoiceSortOrder = 'original' | 'votes' | 'alpha';

const OPTIONS = [
  { value: 'original' as const, label: 'Оригінальний', Icon: List },
  { value: 'votes' as const, label: 'За голосами', Icon: ArrowDownWideNarrow },
  { value: 'alpha' as const, label: 'А-Я', Icon: ArrowDownAZ },
] as const;

interface SortChoicesButtonProps {
  value: ChoiceSortOrder;
  onChange: (order: ChoiceSortOrder) => void;
}

export function SortChoicesButton({ value, onChange }: SortChoicesButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { Icon: CurrentIcon } = OPTIONS.find((o) => o.value === value)!;
  const isActive = value !== 'original';

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        size="icon-sm"
        variant={isActive ? 'default' : 'secondary'}
        title="Сортування"
        onClick={() => setOpen((v) => !v)}
      >
        <CurrentIcon />
      </Button>

      {open && (
        <div className="border-border-color shadow-shadow-sm absolute top-full right-0 z-10 mt-1.5 min-w-36 overflow-hidden rounded-lg border bg-white py-1">
          {OPTIONS.map(({ value: v, label, Icon }) => {
            const selected = value === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => {
                  onChange(v);
                  setOpen(false);
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
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
