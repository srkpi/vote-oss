'use client';

import { format } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useState, type Ref } from 'react';
import { DayPicker } from 'react-day-picker';
import { uk } from 'react-day-picker/locale';

import { cn } from '@/lib/utils/common';
import {
  KYIV_TIME_ZONE,
  kyivDate,
  firstKyivTimeSlot,
  kyivTimeSlots,
  selectKyivDay,
} from '@/lib/utils/kyiv-date-time';

export interface KyivDateTimePickerProps {
  ref?: Ref<HTMLButtonElement>;
  value: Date | string | null | undefined;
  onChange: (utcDate: Date) => void;
  min?: Date | string | null;
  max?: Date | string | null;
  minuteStep?: number;
  id?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  placeholder?: string;
}

export function KyivDateTimePicker({
  ref,
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
}: KyivDateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [fallbackDate, setFallbackDate] = useState(() => new Date());
  const selected = kyivDate(value);
  const minDate = kyivDate(min);
  const maxDate = kyivDate(max);
  const day = selected ?? minDate ?? kyivDate(fallbackDate)!;
  const slots = open ? kyivTimeSlots(day, minuteStep, minDate, maxDate) : [];
  const hour = day.getHours();
  const minute = day.getMinutes();
  const changeTime = (hour: number, minute: number) => {
    const current = kyivDate(day)!;
    const matching = slots.filter((slot) => {
      const date = kyivDate(slot.value)!;
      return date.getHours() === hour && date.getMinutes() === minute;
    });
    const sameOffset = matching.find(
      (slot) => kyivDate(slot.value)!.getTimezoneOffset() === current.getTimezoneOffset(),
    );
    const match = sameOffset ?? matching[0];
    if (match) {
      onChange(new Date(match.value));
      return;
    }
    current.setHours(hour, minute, 0, 0);
    const next = selectKyivDay(day, current, minuteStep, minDate, maxDate);
    if (next) {
      onChange(next);
    }
  };
  const repeated = slots.filter((slot) => slot.label.startsWith(format(day, 'HH:mm') + ' ('));

  return (
    <Popover.Root
      open={open && !disabled}
      onOpenChange={(next) => {
        if (next) {
          setFallbackDate(new Date());
        }
        setOpen(next);
      }}
    >
      <Popover.Trigger asChild>
        <button
          ref={ref}
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            'font-body border-border-color flex h-10 w-full items-center gap-2 rounded-(--radius) border bg-card px-3 text-left text-sm transition-colors',
            'focus-visible:ring-2 focus-visible:ring-kpi-blue-light focus-visible:outline-none',
            'data-[state=open]:border-kpi-blue-light data-[state=open]:ring-2 data-[state=open]:ring-kpi-blue-light/20',
            disabled
              ? 'cursor-not-allowed bg-surface opacity-50'
              : 'cursor-pointer hover:border-kpi-blue-light',
            error && 'border-error',
            className,
          )}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span
            className={cn(
              'flex-1 truncate font-mono tabular-nums',
              !selected && 'font-sans text-subtle',
            )}
          >
            {selected ? format(selected, 'dd.MM.yyyy HH:mm') : placeholder}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          onEscapeKeyDown={(event) => event.stopPropagation()}
          className="font-body border-border-color z-100 max-h-(--radix-popover-content-available-height) w-[296px] max-w-[calc(100vw-1rem)] overflow-auto rounded-xl border bg-card text-sm text-foreground shadow-lg"
        >
          <DayPicker
            mode="single"
            required
            autoFocus
            showOutsideDays
            fixedWeeks
            navLayout="around"
            locale={uk}
            weekStartsOn={1}
            timeZone={KYIV_TIME_ZONE}
            selected={selected}
            defaultMonth={day}
            disabled={(date) => firstKyivTimeSlot(date, minuteStep, minDate, maxDate) === undefined}
            onSelect={(date) => {
              const next = selectKyivDay(date, day, minuteStep, minDate, maxDate);
              if (next) {
                onChange(next);
              }
            }}
            classNames={{
              root: 'w-full',
              months: 'w-full',
              month: 'relative',
              month_caption:
                'flex h-10 items-center justify-center border-b border-border-subtle px-10',
              caption_label: 'font-semibold capitalize',
              button_previous:
                'absolute left-3 top-2 flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-surface',
              button_next:
                'absolute right-3 top-2 flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-surface',
              chevron: 'h-3.5 w-3.5 fill-current',
              month_grid: 'mx-auto mt-2 mb-3 w-[calc(100%-1.5rem)] table-fixed border-collapse',
              weekday: 'h-8 text-xs font-normal text-muted-foreground',
              day: 'p-0 text-center',
              day_button:
                'mx-auto flex h-8 w-8 items-center justify-center rounded-[10px] text-sm transition-colors hover:bg-surface focus-visible:ring-1 focus-visible:ring-kpi-blue-light focus-visible:outline-none',
              selected:
                '[&>button]:bg-kpi-navy [&>button:hover]:bg-kpi-navy [&>button]:font-semibold [&>button]:text-white',
              today:
                '[&:not([data-selected])>button]:ring-1 [&:not([data-selected])>button]:ring-kpi-blue-light/50',
              disabled: 'pointer-events-none opacity-30',
              outside: 'text-muted-foreground',
              hidden: 'invisible',
            }}
          />
          <div className="flex items-center gap-2 border-t border-border-subtle px-3 py-2.5">
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>Час</span>
            <div className="ml-auto flex items-center gap-1">
              <TimeSpinner
                label="Години"
                value={hour}
                max={23}
                onChange={(value) => changeTime(value, minute)}
                onStep={(direction) => changeTime((hour + direction + 24) % 24, minute)}
                disabled={!slots.length}
              />
              <span className="font-semibold">:</span>
              <TimeSpinner
                label="Хвилини"
                value={minute}
                max={59}
                onChange={(value) => changeTime(hour, value)}
                onStep={(direction) =>
                  changeTime(hour, (minute + direction * minuteStep + 60) % 60)
                }
                disabled={!slots.length}
              />
            </div>
          </div>
          {repeated.length > 1 && (
            <select
              title="Зсув київського часу"
              value={selected?.toISOString()}
              onChange={(event) => onChange(new Date(event.target.value))}
              className="border-border-color mb-2 ml-3 rounded border bg-card text-xs"
            >
              {repeated.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function TimeSpinner({
  label,
  value,
  max,
  onChange,
  onStep,
  disabled,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  onStep: (direction: -1 | 1) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft.trim() && Number(draft) <= max) {
      onChange(Number(draft));
    }
    setDraft(null);
  };
  return (
    <div className="border-border-color flex items-center rounded border bg-card">
      <button
        type="button"
        title={`Зменшити: ${label}`}
        disabled={disabled}
        tabIndex={-1}
        onClick={() => onStep(-1)}
        className="rounded-l px-1.5 py-1 text-muted-foreground hover:bg-surface"
      >
        <ChevronLeft className="h-3 w-3" />
      </button>
      <input
        type="text"
        title={label}
        inputMode="numeric"
        value={draft ?? String(value).padStart(2, '0')}
        disabled={disabled}
        onFocus={(event) => {
          setDraft(String(value).padStart(2, '0'));
          event.currentTarget.select();
        }}
        onChange={(event) => setDraft(event.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            setDraft(null);
            onStep(event.key === 'ArrowUp' ? 1 : -1);
          } else if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        className="w-8 bg-transparent py-1 text-center text-sm text-foreground tabular-nums focus:outline-none"
      />
      <button
        type="button"
        title={`Збільшити: ${label}`}
        disabled={disabled}
        tabIndex={-1}
        onClick={() => onStep(1)}
        className="rounded-r px-1.5 py-1 text-muted-foreground hover:bg-surface"
      >
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}
