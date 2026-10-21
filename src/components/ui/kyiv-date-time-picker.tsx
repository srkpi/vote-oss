'use client';

import { format } from 'date-fns';
import { CalendarDays, Clock } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useId, useState, type Ref } from 'react';
import { uk } from 'react-day-picker/locale';

import { Calendar } from '@/components/ui/calendar';
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
  const timeId = useId();
  const [open, setOpen] = useState(false);
  const [fallbackDate, setFallbackDate] = useState(() => new Date());
  const selected = kyivDate(value);
  const minDate = kyivDate(min);
  const maxDate = kyivDate(max);
  const day = selected ?? minDate ?? kyivDate(fallbackDate)!;
  const slots = open ? kyivTimeSlots(day, minuteStep, minDate, maxDate) : [];

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
          <Calendar
            mode="single"
            required
            autoFocus
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
          />
          <div className="border-t border-border-subtle px-3 py-3">
            <label className="mb-2 block text-xs font-medium" htmlFor={timeId}>
              Час (Київ)
            </label>
            <div className="relative">
              <Clock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                id={timeId}
                value={slots.find((slot) => slot.value === selected?.toISOString())?.value ?? ''}
                disabled={!slots.length}
                className="border-border-color h-10 w-full rounded-(--radius) border bg-card pr-3 pl-10 text-sm text-foreground tabular-nums focus:border-kpi-blue-light focus:ring-2 focus:ring-kpi-blue-light/20 focus:outline-none disabled:opacity-50"
                onChange={(event) => onChange(new Date(event.target.value))}
              >
                <option value="" disabled>
                  {selected ? format(selected, 'HH:mm') : 'Оберіть час'}
                </option>
                {slots.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
