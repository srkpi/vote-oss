'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils/common';

export interface StyledSelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface StyledSelectProps {
  options: StyledSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
  upward: boolean;
}

const DROPDOWN_GAP = 4;

function computePosition(trigger: HTMLElement, dropdownHeight: number): DropdownPosition {
  const rect = trigger.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const upward = dropdownHeight > 0 && spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
  return {
    top: upward ? rect.top - DROPDOWN_GAP : rect.bottom + DROPDOWN_GAP,
    left: rect.left,
    width: rect.width,
    upward,
  };
}

export function StyledSelect({
  options,
  value,
  onChange,
  placeholder = 'Оберіть…',
  disabled = false,
  error = false,
  className,
  id,
  'aria-label': ariaLabel,
}: StyledSelectProps) {
  const uid = useId();
  const listboxId = `select-list-${uid}`;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState<DropdownPosition | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  function openDropdown() {
    if (disabled || !triggerRef.current) return;
    setActiveIndex(options.findIndex((o) => o.value === value));
    // Initial position assumes downward; refined once dropdown mounts.
    setPosition(computePosition(triggerRef.current, 0));
    setOpen(true);
  }

  function closeDropdown() {
    setOpen(false);
    setActiveIndex(-1);
    setPosition(null);
  }

  function selectOption(option: StyledSelectOption) {
    if (option.disabled) return;
    onChange(option.value);
    closeDropdown();
    triggerRef.current?.focus();
  }

  // Callback ref — runs synchronously when the dropdown DOM node mounts so we
  // can re-measure with its real height and decide whether to flip upward.
  const dropdownCallbackRef = useCallback((node: HTMLDivElement | null) => {
    dropdownRef.current = node;
    if (!node || !triggerRef.current) return;
    setPosition(computePosition(triggerRef.current, node.offsetHeight));
  }, []);

  // Keep position synced while open
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (!triggerRef.current) return;
      const h = dropdownRef.current?.offsetHeight ?? 0;
      setPosition(computePosition(triggerRef.current, h));
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  // Close on outside pointer events
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      closeDropdown();
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLElement>('[role="option"]');
    items[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDropdown();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (activeIndex >= 0 && options[activeIndex]) {
          selectOption(options[activeIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeDropdown();
        triggerRef.current?.focus();
        break;
    }
  }

  const dropdown = open && typeof document !== 'undefined' && (
    <div
      ref={dropdownCallbackRef}
      style={{
        position: 'fixed',
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        width: position?.width ?? undefined,
        transform: position?.upward ? 'translateY(-100%)' : undefined,
      }}
      className={cn(
        'z-50',
        'overflow-hidden rounded-lg',
        'border-border-color border bg-white',
        'shadow-shadow-lg',
        'animate-scale-in',
      )}
    >
      <div
        ref={listRef}
        id={listboxId}
        role="listbox"
        className="max-h-60 overflow-y-auto overscroll-contain py-1"
      >
        {options.length === 0 ? (
          <div className="font-body text-muted-foreground px-3 py-6 text-center text-sm">
            Немає варіантів
          </div>
        ) : (
          options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                onClick={() => selectOption(option)}
                onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                className={cn(
                  'font-body flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm',
                  'transition-colors duration-75',
                  isSelected ? 'text-kpi-navy font-medium' : 'text-foreground',
                  isActive && !isSelected ? 'bg-surface' : '',
                  isSelected ? 'bg-kpi-navy/5' : '',
                  isActive && isSelected ? 'bg-kpi-navy/10' : '',
                  option.disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <Check
                  className={cn(
                    'text-kpi-navy h-3.5 w-3.5 shrink-0',
                    isSelected ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span className="truncate">{option.label}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? closeDropdown() : openDropdown())}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex h-10 w-full items-center gap-2 rounded-(--radius) bg-white',
          'border-border-color border',
          'font-body px-3 text-left text-sm',
          'transition-colors duration-150',
          !disabled && 'hover:border-kpi-blue-light cursor-pointer',
          open && 'border-kpi-blue-light ring-kpi-blue-light/20 ring-2',
          error && !open && 'border-error focus:border-error focus:ring-error/20',
          disabled && 'bg-surface cursor-not-allowed opacity-50',
          'focus-visible:ring-kpi-blue-light focus-visible:ring-2 focus-visible:outline-none',
        )}
      >
        <span className={cn('flex-1 truncate', !selectedOption && 'text-subtle')}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            'text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-150',
            open && (position?.upward ? '-rotate-180' : 'rotate-180'),
          )}
        />
      </button>

      {dropdown && createPortal(dropdown, document.body)}
    </div>
  );
}
