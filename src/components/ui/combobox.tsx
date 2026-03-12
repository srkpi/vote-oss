'use client';

import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

export interface ComboboxProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  error?: boolean;
  emptyText?: string;
  className?: string;
  id?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Оберіть…',
  searchPlaceholder = 'Пошук…',
  clearable = false,
  disabled = false,
  error = false,
  emptyText = 'Нічого не знайдено',
  className,
  id,
}: ComboboxProps) {
  const uid = useId();
  const listboxId = `combobox-list-${uid}`;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [openUpward, setOpenUpward] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const filtered = options.filter((opt) => opt.toLowerCase().includes(search.toLowerCase()));

  // ── Measure available space and decide direction ─────────────────────────
  useLayoutEffect(() => {
    if (!open || !containerRef.current || !dropdownRef.current) return;

    const triggerRect = containerRef.current.getBoundingClientRect();
    const dropdownHeight = dropdownRef.current.offsetHeight;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;

    // Prefer below; flip upward only when there is not enough room below but
    // there IS enough room above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenUpward(spaceBelow < dropdownHeight && spaceAbove > spaceBelow);
  }, [open, filtered.length]);

  // ── Open / close helpers ─────────────────────────────────────────────────

  function openDropdown() {
    if (disabled) return;
    setOpenUpward(false); // reset before measuring
    setOpen(true);
    setActiveIndex(-1);
  }

  function closeDropdown() {
    setOpen(false);
    setSearch('');
    setActiveIndex(-1);
  }

  function selectOption(option: string) {
    onChange(option);
    closeDropdown();
    triggerRef.current?.focus();
  }

  function clearValue(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
    closeDropdown();
  }

  // ── Focus search input when dropdown opens ───────────────────────────────
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ── Close on outside click ───────────────────────────────────────────────
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  // ── Scroll active option into view ───────────────────────────────────────
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLElement>('[role="option"]');
    items[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // ── Keyboard handling on the search input ───────────────────────────────
  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && filtered[activeIndex]) {
          selectOption(filtered[activeIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeDropdown();
        triggerRef.current?.focus();
        break;
      default:
        setActiveIndex(-1);
    }
  }

  // ── Keyboard handling on the trigger button ──────────────────────────────
  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDropdown();
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        onClick={() => (open ? closeDropdown() : openDropdown())}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          'flex h-10 w-full items-center gap-2 rounded-[var(--radius)] bg-white',
          'border border-[var(--border-color)]',
          'px-3 text-sm font-body text-left',
          'transition-colors duration-150',
          !disabled && 'hover:border-[var(--kpi-blue-light)] cursor-pointer',
          open && 'border-[var(--kpi-blue-light)] ring-2 ring-[var(--kpi-blue-light)]/20',
          error &&
            !open &&
            'border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]/20',
          disabled && 'opacity-50 cursor-not-allowed bg-[var(--surface)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kpi-blue-light)]',
        )}
      >
        {/* Label */}
        <span className={cn('flex-1 truncate', !value && 'text-[var(--subtle)]')}>
          {value || placeholder}
        </span>

        {/* Clear button */}
        {clearable && value && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Скинути"
            onClick={clearValue}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') clearValue(e as unknown as React.MouseEvent);
            }}
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded',
              'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
              'hover:bg-[var(--surface)] transition-colors',
            )}
          >
            <X className="h-3 w-3" />
          </span>
        )}

        {/* Chevron — rotates toward the open direction */}
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform duration-150',
            open && (openUpward ? '-rotate-180' : 'rotate-180'),
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          className={cn(
            'absolute z-50 w-full min-w-[200px]',
            'overflow-hidden rounded-[var(--radius-lg)]',
            'border border-[var(--border-color)] bg-white',
            'shadow-[var(--shadow-lg)]',
            'animate-scale-in',
            openUpward ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
        >
          {/* Search input */}
          <div className="border-b border-[var(--border-subtle)] p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setActiveIndex(-1);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder={searchPlaceholder}
                className={cn(
                  'h-8 w-full rounded-[var(--radius-sm)] bg-[var(--surface)]',
                  'pl-8 pr-3 text-sm font-body text-[var(--foreground)]',
                  'placeholder:text-[var(--subtle)]',
                  'border border-transparent',
                  'focus:outline-none focus:border-[var(--kpi-blue-light)]',
                  'transition-colors duration-150',
                  search && 'pr-7',
                )}
              />
              {search && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            className="max-h-60 overflow-y-auto overscroll-contain py-1"
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm font-body text-[var(--muted-foreground)]">
                {emptyText}
              </div>
            ) : (
              filtered.map((option, index) => {
                const isSelected = option === value;
                const isActive = index === activeIndex;
                return (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => selectOption(option)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-3 py-2 text-sm font-body text-left',
                      'transition-colors duration-75',
                      isSelected
                        ? 'text-[var(--kpi-navy)] font-medium'
                        : 'text-[var(--foreground)]',
                      isActive && !isSelected ? 'bg-[var(--surface)]' : '',
                      isSelected ? 'bg-[var(--kpi-navy)]/5' : '',
                      isActive && isSelected ? 'bg-[var(--kpi-navy)]/10' : '',
                    )}
                  >
                    <Check
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 text-[var(--kpi-navy)]',
                        isSelected ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="truncate">{option}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
