'use client';

import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { cn } from '@/lib/utils/common';

export interface MultiComboboxProps {
  options: string[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  error?: boolean;
  emptyText?: string;
  className?: string;
  id?: string;
  maxSelected?: number;
}

export function MultiCombobox({
  options,
  value,
  onChange,
  placeholder = 'Оберіть…',
  searchPlaceholder = 'Пошук…',
  disabled = false,
  error = false,
  emptyText = 'Нічого не знайдено',
  className,
  id,
  maxSelected,
}: MultiComboboxProps) {
  const uid = useId();
  const listboxId = `multi-combobox-list-${uid}`;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [openUpward, setOpenUpward] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter((opt) => opt.toLowerCase().includes(search.toLowerCase()));

  const dropdownCallbackRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || !containerRef.current) return;
    const triggerRect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    setOpenUpward(spaceBelow < node.offsetHeight && spaceAbove > spaceBelow);
  }, []);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  function toggleOption(option: string) {
    if (value.includes(option)) {
      onChange(value.filter((v) => v !== option));
    } else {
      if (maxSelected && value.length >= maxSelected) return;
      onChange([...value, option]);
    }
  }

  function removeValue(option: string, e: React.MouseEvent) {
    e.stopPropagation();
    onChange(value.filter((v) => v !== option));
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div
        ref={triggerRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className={cn(
          'flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-(--radius) bg-white',
          'border-border-color border',
          'font-body px-2.5 py-1.5 text-left text-sm',
          'transition-colors duration-150',
          !disabled && 'hover:border-kpi-blue-light cursor-pointer',
          open && 'border-kpi-blue-light ring-kpi-blue-light/20 ring-2',
          error && !open && 'border-error',
          disabled && 'bg-surface cursor-not-allowed opacity-50',
          'outline-none',
          className,
        )}
      >
        {value.length === 0 ? (
          <span className="text-subtle flex-1">{placeholder}</span>
        ) : (
          <>
            {value.map((v) => (
              <span
                key={v}
                className="bg-kpi-navy/10 text-kpi-navy flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium"
              >
                {v}
                <button
                  type="button"
                  onClick={(e) => removeValue(v, e)}
                  className="text-kpi-navy/60 hover:text-kpi-navy ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <span className="flex-1" />
          </>
        )}
        <ChevronDown
          className={cn(
            'text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </div>

      {open && (
        <div
          ref={dropdownCallbackRef}
          className={cn(
            'absolute z-50 w-full min-w-50 overflow-hidden rounded-lg',
            'border-border-color shadow-shadow-lg animate-scale-in border bg-white',
            openUpward ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
        >
          <div className="border-border-subtle border-b p-2">
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className={cn(
                  'bg-surface h-8 w-full rounded-sm',
                  'font-body text-foreground placeholder:text-subtle pr-3 pl-8 text-sm',
                  'focus:border-kpi-blue-light border border-transparent focus:outline-none',
                )}
              />
            </div>
          </div>
          <div id={listboxId} role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="font-body text-muted-foreground px-3 py-6 text-center text-sm">
                {emptyText}
              </div>
            ) : (
              filtered.map((option) => {
                const isSelected = value.includes(option);
                const isDisabled =
                  !isSelected && maxSelected != null && value.length >= maxSelected;
                return (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={isDisabled}
                    onClick={() => toggleOption(option)}
                    className={cn(
                      'font-body flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm',
                      'transition-colors duration-75',
                      isSelected ? 'bg-kpi-navy/5 text-kpi-navy font-medium' : 'text-foreground',
                      !isSelected && !isDisabled && 'hover:bg-surface',
                      isDisabled && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                        isSelected ? 'border-kpi-navy bg-kpi-navy' : 'border-border-color',
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className="truncate">{option}</span>
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
                className="font-body text-muted-foreground hover:text-foreground w-full rounded px-2 py-1 text-xs transition-colors"
              >
                Скинути все
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
