'use client';

import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

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
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const filtered = options.filter((opt) => opt.toLowerCase().includes(search.toLowerCase()));

  const dropdownCallbackRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || !containerRef.current) return;

    const triggerRect = containerRef.current.getBoundingClientRect();
    const dropdownHeight = node.offsetHeight;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;

    setOpenUpward(spaceBelow < dropdownHeight && spaceAbove > spaceBelow);
  }, []);

  function openDropdown() {
    if (disabled) return;
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

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  // Scroll active option into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLElement>('[role="option"]');
    items[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // Keyboard handling on the search input
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

  // Keyboard handling on the trigger button
  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDropdown();
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
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
          'flex h-10 w-full items-center gap-2 rounded-(--radius) bg-white',
          'border border-(--border-color)',
          'font-body px-3 text-left text-sm',
          'transition-colors duration-150',
          !disabled && 'cursor-pointer hover:border-(--kpi-blue-light)',
          open && 'border-(--kpi-blue-light) ring-2 ring-(--kpi-blue-light)/20',
          error && !open && 'border-(--error) focus:border-(--error) focus:ring-(--error)/20',
          disabled && 'cursor-not-allowed bg-(--surface) opacity-50',
          'focus-visible:ring-2 focus-visible:ring-(--kpi-blue-light) focus-visible:outline-none',
        )}
      >
        <span className={cn('flex-1 truncate', !value && 'text-(--subtle)')}>
          {value || placeholder}
        </span>

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
              'text-(--muted-foreground) hover:text-(--foreground)',
              'transition-colors hover:bg-(--surface)',
            )}
          >
            <X className="h-3 w-3" />
          </span>
        )}
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-(--muted-foreground) transition-transform duration-150',
            open && (openUpward ? '-rotate-180' : 'rotate-180'),
          )}
        />
      </button>

      {open && (
        <div
          ref={dropdownCallbackRef}
          className={cn(
            'absolute z-50 w-full min-w-50',
            'overflow-hidden rounded-lg',
            'border border-(--border-color) bg-white',
            'shadow-(--shadow-lg)',
            'animate-scale-in',
            openUpward ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
        >
          <div className="border-b border-(--border-subtle) p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-(--muted-foreground)" />
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
                  'h-8 w-full rounded-sm bg-(--surface)',
                  'font-body pr-3 pl-8 text-sm text-(--foreground)',
                  'placeholder:text-(--subtle)',
                  'border border-transparent',
                  'focus:border-(--kpi-blue-light) focus:outline-none',
                  'transition-colors duration-150',
                  search && 'pr-7',
                )}
              />
              {search && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setSearch('')}
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-(--muted-foreground) hover:text-(--foreground)"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            className="max-h-60 overflow-y-auto overscroll-contain py-1"
          >
            {filtered.length === 0 ? (
              <div className="font-body px-3 py-6 text-center text-sm text-(--muted-foreground)">
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
                      'font-body flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm',
                      'transition-colors duration-75',
                      isSelected ? 'font-medium text-(--kpi-navy)' : 'text-(--foreground)',
                      isActive && !isSelected ? 'bg-(--surface)' : '',
                      isSelected ? 'bg-(--kpi-navy)/5' : '',
                      isActive && isSelected ? 'bg-(--kpi-navy)/10' : '',
                    )}
                  >
                    <Check
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 text-(--kpi-navy)',
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
