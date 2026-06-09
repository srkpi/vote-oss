'use client';

import { format, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import * as React from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils/common';

const KYIV_TZ = 'Europe/Kyiv';

const WEEKDAYS_UK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const MONTHS_UK = [
  'Січень',
  'Лютий',
  'Березень',
  'Квітень',
  'Травень',
  'Червень',
  'Липень',
  'Серпень',
  'Вересень',
  'Жовтень',
  'Листопад',
  'Грудень',
];

interface KyivParts {
  year: number;
  month: number; // 0..11
  day: number;
  hour: number;
  minute: number;
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function getKyivParts(utc: Date): KyivParts {
  const k = toZonedTime(utc, KYIV_TZ);
  return {
    year: parseInt(format(k, 'yyyy', { timeZone: KYIV_TZ }), 10),
    month: parseInt(format(k, 'M', { timeZone: KYIV_TZ }), 10) - 1,
    day: parseInt(format(k, 'd', { timeZone: KYIV_TZ }), 10),
    hour: parseInt(format(k, 'H', { timeZone: KYIV_TZ }), 10),
    minute: parseInt(format(k, 'm', { timeZone: KYIV_TZ }), 10),
  };
}

function buildKyivUtc(parts: KyivParts): Date {
  const s = `${String(parts.year).padStart(4, '0')}-${String(parts.month + 1).padStart(2, '0')}-${String(
    parts.day,
  ).padStart(
    2,
    '0',
  )}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}:00`;
  return fromZonedTime(s, KYIV_TZ);
}

function formatDisplay(utc: Date | null): string {
  if (!utc) return '';
  return format(toZonedTime(utc, KYIV_TZ), 'dd.MM.yyyy HH:mm', { timeZone: KYIV_TZ });
}

function dayOfWeekMon0(year: number, month: number, day: number): number {
  // Treat as UTC to avoid host TZ effects on calendar arithmetic.
  return (new Date(Date.UTC(year, month, day)).getUTCDay() + 6) % 7;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function snapToStep(value: number, step: number): number {
  if (step <= 1) return value;
  return Math.round(value / step) * step;
}

function partsCompare(a: KyivParts, b: KyivParts): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  if (a.day !== b.day) return a.day - b.day;
  if (a.hour !== b.hour) return a.hour - b.hour;
  return a.minute - b.minute;
}

interface PopoverPosition {
  top: number;
  left: number;
  upward: boolean;
}

const POPOVER_GAP = 4;
const POPOVER_WIDTH = 296;

function computePosition(trigger: HTMLElement, popoverHeight: number): PopoverPosition {
  const rect = trigger.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const upward = popoverHeight > 0 && spaceBelow < popoverHeight && spaceAbove > spaceBelow;
  const maxLeft = window.innerWidth - POPOVER_WIDTH - 8;
  const desiredLeft = Math.max(8, Math.min(rect.left, maxLeft));
  return {
    top: upward ? rect.top - POPOVER_GAP : rect.bottom + POPOVER_GAP,
    left: desiredLeft,
    upward,
  };
}

export interface KyivDateTimePickerProps {
  value: Date | string | null | undefined;
  onChange: (utcDate: Date) => void;
  min?: Date | string | null;
  max?: Date | string | null;
  /** Minute step (default 1). Use 30 for 30-minute snap inside the picker. */
  minuteStep?: number;
  id?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  placeholder?: string;
}

export const KyivDateTimePicker = React.forwardRef<HTMLButtonElement, KyivDateTimePickerProps>(
  (
    {
      value,
      onChange,
      min,
      max,
      minuteStep = 1,
      id,
      disabled = false,
      error = false,
      className,
      placeholder = 'ДД.ММ.РРРР ГГ:ХХ',
    },
    ref,
  ) => {
    const utcValue = toDate(value);
    const minDate = toDate(min);
    const maxDate = toDate(max);
    const minParts = minDate ? getKyivParts(minDate) : null;
    const maxParts = maxDate ? getKyivParts(maxDate) : null;

    const [open, setOpen] = React.useState(false);
    const [position, setPosition] = React.useState<PopoverPosition | null>(null);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const popoverRef = React.useRef<HTMLDivElement | null>(null);

    React.useImperativeHandle(ref, () => triggerRef.current as HTMLButtonElement);

    // Effective parts for time inputs / fallback when value is null.
    const fallbackParts = React.useMemo<KyivParts>(() => {
      const base = utcValue ?? minDate ?? new Date();
      const p = getKyivParts(base);
      return { ...p, minute: snapToStep(p.minute, minuteStep) };
    }, [utcValue, minDate, minuteStep]);

    const currentParts: KyivParts = utcValue ? getKyivParts(utcValue) : fallbackParts;

    // Calendar view (visible month).
    const [view, setView] = React.useState<{ year: number; month: number }>(() => ({
      year: fallbackParts.year,
      month: fallbackParts.month,
    }));

    // Sync view to value when popover opens.
    React.useEffect(() => {
      if (open) {
        const target = utcValue ? getKyivParts(utcValue) : fallbackParts;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setView({ year: target.year, month: target.month });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const openPopover = React.useCallback(() => {
      if (disabled || !triggerRef.current) return;
      setPosition(computePosition(triggerRef.current, 0));
      setOpen(true);
    }, [disabled]);

    const closePopover = React.useCallback(() => {
      setOpen(false);
      setPosition(null);
    }, []);

    // Re-measure once the popover mounts to use its real height.
    const popoverCallbackRef = React.useCallback((node: HTMLDivElement | null) => {
      popoverRef.current = node;
      if (!node || !triggerRef.current) return;
      setPosition(computePosition(triggerRef.current, node.offsetHeight));
    }, []);

    // Reposition on scroll/resize while open.
    React.useEffect(() => {
      if (!open) return;
      const update = () => {
        if (!triggerRef.current) return;
        const h = popoverRef.current?.offsetHeight ?? 0;
        setPosition(computePosition(triggerRef.current, h));
      };
      window.addEventListener('resize', update);
      window.addEventListener('scroll', update, true);
      return () => {
        window.removeEventListener('resize', update);
        window.removeEventListener('scroll', update, true);
      };
    }, [open]);

    // Outside-pointer-down close.
    React.useEffect(() => {
      if (!open) return;
      const handler = (e: PointerEvent) => {
        const t = e.target as Node;
        if (triggerRef.current?.contains(t)) return;
        if (popoverRef.current?.contains(t)) return;
        closePopover();
      };
      document.addEventListener('pointerdown', handler);
      return () => document.removeEventListener('pointerdown', handler);
    }, [open, closePopover]);

    // Esc to close.
    React.useEffect(() => {
      if (!open) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          closePopover();
          triggerRef.current?.focus();
        }
      };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }, [open, closePopover]);

    const emit = React.useCallback(
      (parts: KyivParts) => {
        // Clamp to min/max range so the picker never produces an out-of-range value.
        let candidate = parts;
        if (minParts && partsCompare(candidate, minParts) < 0) candidate = minParts;
        if (maxParts && partsCompare(candidate, maxParts) > 0) candidate = maxParts;
        onChange(buildKyivUtc(candidate));
      },
      [minParts, maxParts, onChange],
    );

    const isDayDisabled = (year: number, month: number, day: number): boolean => {
      if (minParts) {
        const endOfDay: KyivParts = { year, month, day, hour: 23, minute: 59 };
        if (partsCompare(endOfDay, minParts) < 0) return true;
      }
      if (maxParts) {
        const startOfDay: KyivParts = { year, month, day, hour: 0, minute: 0 };
        if (partsCompare(startOfDay, maxParts) > 0) return true;
      }
      return false;
    };

    const handleDayClick = (cell: {
      year: number;
      month: number;
      day: number;
      otherMonth: boolean;
    }) => {
      if (cell.otherMonth) {
        setView({ year: cell.year, month: cell.month });
      }
      const newParts: KyivParts = {
        year: cell.year,
        month: cell.month,
        day: cell.day,
        hour: currentParts.hour,
        minute: snapToStep(currentParts.minute, minuteStep),
      };
      emit(newParts);
    };

    const handleHourChange = (raw: string) => {
      const n = parseInt(raw, 10);
      if (Number.isNaN(n)) return;
      const hour = Math.max(0, Math.min(23, n));
      emit({ ...currentParts, hour });
    };

    const handleMinuteChange = (raw: string) => {
      const n = parseInt(raw, 10);
      if (Number.isNaN(n)) return;
      const minute = snapToStep(Math.max(0, Math.min(59, n)), minuteStep);
      emit({ ...currentParts, minute });
    };

    const adjustHour = (delta: number) => {
      const hour = (currentParts.hour + delta + 24) % 24;
      emit({ ...currentParts, hour });
    };

    const adjustMinute = (delta: number) => {
      const step = minuteStep > 1 ? minuteStep : 1;
      const total = snapToStep(currentParts.minute, step) + delta * step;
      const wrap = ((total % 60) + 60) % 60;
      emit({ ...currentParts, minute: wrap });
    };

    const prevMonth = () => {
      setView(({ year, month }) =>
        month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 },
      );
    };
    const nextMonth = () => {
      setView(({ year, month }) =>
        month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 },
      );
    };

    // Build 6×7 calendar grid.
    const firstDow = dayOfWeekMon0(view.year, view.month, 1);
    const totalDays = daysInMonth(view.year, view.month);
    const prevTotalDays = daysInMonth(
      view.month === 0 ? view.year - 1 : view.year,
      view.month === 0 ? 11 : view.month - 1,
    );
    type CellInfo = { day: number; month: number; year: number; otherMonth: boolean };
    const cells: CellInfo[] = [];
    for (let i = firstDow - 1; i >= 0; i--) {
      cells.push({
        day: prevTotalDays - i,
        month: view.month === 0 ? 11 : view.month - 1,
        year: view.month === 0 ? view.year - 1 : view.year,
        otherMonth: true,
      });
    }
    for (let d = 1; d <= totalDays; d++) {
      cells.push({ day: d, month: view.month, year: view.year, otherMonth: false });
    }
    while (cells.length < 42) {
      const last = cells[cells.length - 1];
      let nDay = last.day + 1;
      let nMonth = last.month;
      let nYear = last.year;
      if (nDay > daysInMonth(nYear, nMonth)) {
        nDay = 1;
        if (nMonth === 11) {
          nMonth = 0;
          nYear += 1;
        } else {
          nMonth += 1;
        }
      }
      cells.push({
        day: nDay,
        month: nMonth,
        year: nYear,
        otherMonth: nMonth !== view.month || nYear !== view.year,
      });
    }

    const selected = utcValue ? getKyivParts(utcValue) : null;
    const todayParts = getKyivParts(new Date());
    const displayValue = formatDisplay(utcValue);

    const popover = open && typeof document !== 'undefined' && (
      <div
        ref={popoverCallbackRef}
        style={{
          position: 'fixed',
          top: position?.top ?? -9999,
          left: position?.left ?? -9999,
          width: POPOVER_WIDTH,
          transform: position?.upward ? 'translateY(-100%)' : undefined,
        }}
        className={cn(
          'z-50 overflow-hidden rounded-lg',
          'border-border-color border bg-white',
          'shadow-shadow-lg',
          'animate-scale-in',
        )}
        role="dialog"
      >
        {/* Month header */}
        <div className="border-border-subtle flex items-center justify-between border-b px-3 py-2">
          <button
            type="button"
            onClick={prevMonth}
            className="text-muted-foreground hover:bg-surface hover:text-foreground rounded p-1 transition-colors"
            aria-label="Попередній місяць"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="font-body text-foreground text-sm font-semibold">
            {MONTHS_UK[view.month]} {view.year}
          </div>
          <button
            type="button"
            onClick={nextMonth}
            className="text-muted-foreground hover:bg-surface hover:text-foreground rounded p-1 transition-colors"
            aria-label="Наступний місяць"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Calendar grid */}
        <div className="px-3 pt-3">
          <div className="mb-1.5 grid grid-cols-7 gap-0.5">
            {WEEKDAYS_UK.map((wd) => (
              <div key={wd} className="font-body text-muted-foreground text-center text-xs">
                {wd}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((c, i) => {
              const dayDisabled = isDayDisabled(c.year, c.month, c.day);
              const isSelected =
                !!selected &&
                c.year === selected.year &&
                c.month === selected.month &&
                c.day === selected.day;
              const isToday =
                c.year === todayParts.year &&
                c.month === todayParts.month &&
                c.day === todayParts.day;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={dayDisabled}
                  onClick={() => handleDayClick(c)}
                  className={cn(
                    'font-body h-8 rounded text-center text-sm transition-colors',
                    'focus-visible:ring-kpi-blue-light focus-visible:ring-2 focus-visible:outline-none',
                    dayDisabled && 'cursor-not-allowed opacity-30',
                    !dayDisabled && !isSelected && 'hover:bg-surface',
                    c.otherMonth && !isSelected && 'text-muted-foreground',
                    !c.otherMonth && !isSelected && 'text-foreground',
                    isSelected && 'bg-kpi-navy font-semibold text-white',
                    isToday && !isSelected && 'ring-kpi-blue-light/40 ring-1',
                  )}
                >
                  {c.day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time row */}
        <div className="border-border-subtle mt-2 flex items-center gap-2 border-t px-3 py-2.5">
          <Clock className="text-muted-foreground h-4 w-4 shrink-0" />
          <span className="font-body text-foreground text-sm">Час</span>
          <div className="flex flex-1 items-center justify-end gap-1">
            <TimeSpinner
              value={currentParts.hour}
              max={23}
              onChange={handleHourChange}
              onIncrement={() => adjustHour(1)}
              onDecrement={() => adjustHour(-1)}
              ariaLabel="Години"
            />
            <span className="font-body text-foreground text-sm font-semibold">:</span>
            <TimeSpinner
              value={currentParts.minute}
              max={59}
              step={minuteStep}
              onChange={handleMinuteChange}
              onIncrement={() => adjustMinute(1)}
              onDecrement={() => adjustMinute(-1)}
              ariaLabel="Хвилини"
            />
          </div>
        </div>
      </div>
    );

    return (
      <div className={cn('relative', className)}>
        <button
          ref={triggerRef}
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => (open ? closePopover() : openPopover())}
          aria-haspopup="dialog"
          aria-expanded={open}
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
          <CalendarDays className="text-muted-foreground h-4 w-4 shrink-0" />
          <span
            className={cn(
              'flex-1 truncate font-mono tabular-nums',
              !displayValue && 'text-subtle font-sans',
            )}
          >
            {displayValue || placeholder}
          </span>
        </button>

        {popover && createPortal(popover, document.body)}
      </div>
    );
  },
);
KyivDateTimePicker.displayName = 'KyivDateTimePicker';

interface TimeSpinnerProps {
  value: number;
  max: number;
  step?: number;
  onChange: (raw: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  ariaLabel: string;
}

function TimeSpinner({
  value,
  max,
  step = 1,
  onChange,
  onIncrement,
  onDecrement,
  ariaLabel,
}: TimeSpinnerProps) {
  const [draft, setDraft] = React.useState<string>(String(value).padStart(2, '0'));
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!focused) setDraft(String(value).padStart(2, '0'));
  }, [value, focused]);

  return (
    <div className="border-border-color flex items-center rounded border bg-white">
      <button
        type="button"
        onClick={onDecrement}
        className="text-muted-foreground hover:bg-surface hover:text-foreground rounded-l px-1.5 py-1 transition-colors"
        aria-label={`${ariaLabel} -${step}`}
        tabIndex={-1}
      >
        <ChevronLeft className="h-3 w-3" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={ariaLabel}
        value={draft}
        onFocus={(e) => {
          setFocused(true);
          e.currentTarget.select();
        }}
        onBlur={() => {
          setFocused(false);
          if (draft === '') {
            setDraft(String(value).padStart(2, '0'));
            return;
          }
          onChange(draft);
        }}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
          setDraft(v);
          if (v === '') return;
          const n = parseInt(v, 10);
          if (n > max) return;
          onChange(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            onIncrement();
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            onDecrement();
          }
        }}
        className="font-body text-foreground w-8 bg-transparent py-1 text-center text-sm tabular-nums focus:outline-none"
      />
      <button
        type="button"
        onClick={onIncrement}
        className="text-muted-foreground hover:bg-surface hover:text-foreground rounded-r px-1.5 py-1 transition-colors"
        aria-label={`${ariaLabel} +${step}`}
        tabIndex={-1}
      >
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}
