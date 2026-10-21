'use client';

import { closestTo, eachMinuteOfInterval, endOfDay, format, startOfDay } from 'date-fns';
import { CalendarDays, Clock } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useId, useState, type Ref } from 'react';
import { TZDate } from 'react-day-picker';
import { uk } from 'react-day-picker/locale';
import { z } from 'zod';

import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils/common';

const KYIV_TIME_ZONE = 'Europe/Kyiv';
const kyivDateSchema = z
  .union([z.date(), z.string().min(1)])
  .pipe(z.coerce.date())
  .transform((date) => new TZDate(date, KYIV_TIME_ZONE));
const minuteStepSchema = z.number().int().min(1).max(60).catch(1);

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
  const selected = kyivDateSchema.safeParse(value).data;
  const minDate = kyivDateSchema.safeParse(min).data;
  const maxDate = kyivDateSchema.safeParse(max).data;
  const day = selected ?? minDate ?? new TZDate(fallbackDate, KYIV_TIME_ZONE);
  const step = minuteStepSchema.parse(minuteStep);
  let slotSchema = z.date();
  if (minDate) {
    slotSchema = slotSchema.min(minDate);
  }
  if (maxDate) {
    slotSchema = slotSchema.max(maxDate);
  }
  const timesForDay = (date: Date, firstOnly = false) => {
    const zoned = new TZDate(date, KYIV_TIME_ZONE);
    const start =
      Math.ceil(Math.max(+startOfDay(zoned), minDate ? +minDate : -Infinity) / 60_000) * 60_000;
    const end = Math.min(
      +endOfDay(zoned),
      maxDate ? +maxDate : Infinity,
      firstOnly ? start + 59 * 60_000 : Infinity,
    );
    if (start > end) {
      return [];
    }
    return eachMinuteOfInterval({
      start: new TZDate(start, KYIV_TIME_ZONE),
      end: new TZDate(end, KYIV_TIME_ZONE),
    }).filter((time) => time.getMinutes() % step === 0 && slotSchema.safeParse(time).success);
  };
  const times = open ? timesForDay(day) : [];
  const labels = times.map((time) => format(time, 'HH:mm'));
  const counts = new Map<string, number>();
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const slots = times.map((time, index) => ({
    value: time.toISOString(),
    label:
      counts.get(labels[index])! > 1
        ? labels[index] + ' (' + format(time, 'xxx') + ')'
        : labels[index],
  }));

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
            disabled={(date) => !timesForDay(date, true).length}
            onSelect={(date) => {
              const target = new TZDate(date, KYIV_TIME_ZONE);
              target.setHours(day.getHours(), day.getMinutes(), 0, 0);
              const next = closestTo(target, timesForDay(date));
              if (next) {
                onChange(new Date(next));
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
