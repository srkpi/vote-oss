'use client';

import 'react-day-picker/style.css';

import { format } from 'date-fns';
import { CalendarDays, Clock } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useId, useState, type CSSProperties, type Ref } from 'react';
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
  const timeId = useId();
  const [fallbackDate, setFallbackDate] = useState(() => new Date());
  const selected = kyivDate(value);
  const minDate = kyivDate(min);
  const maxDate = kyivDate(max);
  const day = selected ?? minDate ?? kyivDate(fallbackDate)!;
  const slots = open ? kyivTimeSlots(day, minuteStep, minDate, maxDate) : [];
  const selectedValue = selected?.toISOString() ?? '';

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
          sideOffset={6}
          collisionPadding={8}
          onEscapeKeyDown={(event) => event.stopPropagation()}
          className="border-border-color z-100 max-h-(--radix-popover-content-available-height) overflow-auto rounded-lg border bg-card p-3 text-foreground shadow-lg"
        >
          <DayPicker
            mode="single"
            required
            autoFocus
            showOutsideDays
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
            style={
              {
                '--rdp-accent-color': 'var(--kpi-navy)',
                '--rdp-accent-background-color': 'var(--surface)',
                '--rdp-day-height': '2.25rem',
                '--rdp-day-width': '2.25rem',
                '--rdp-day_button-height': '2rem',
                '--rdp-day_button-width': '2rem',
              } as CSSProperties
            }
          />
          <div className="mt-3 flex items-center gap-2 border-t border-border-subtle pt-3">
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <label htmlFor={timeId} className="font-body text-sm">
              Час (Київ)
            </label>
            <select
              id={timeId}
              value={selectedValue}
              disabled={!slots.length}
              onChange={(event) => onChange(new Date(event.target.value))}
              className="border-border-color ml-auto rounded border bg-card px-2 py-1 text-sm tabular-nums"
            >
              {!slots.some((slot) => slot.value === selectedValue) && (
                <option value={selectedValue} disabled>
                  {selected ? format(selected, 'HH:mm') : 'Оберіть час'}
                </option>
              )}
              {slots.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
