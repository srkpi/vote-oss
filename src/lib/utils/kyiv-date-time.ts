import { addDays, format, startOfDay } from 'date-fns';
import { TZDate } from 'react-day-picker';

export const KYIV_TIME_ZONE = 'Europe/Kyiv';
const MINUTE_MS = 60_000;

export function kyivDate(value: Date | string | null | undefined): TZDate | undefined {
  if (!value) {
    return undefined;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new TZDate(time, KYIV_TIME_ZONE) : undefined;
}

export function minuteInterval(step: number): number {
  return Number.isInteger(step) && step >= 1 && step <= 60 ? step : 1;
}

function dayBounds(day: Date, min?: Date, max?: Date) {
  const start = startOfDay(new TZDate(day, KYIV_TIME_ZONE));
  return {
    first:
      Math.ceil(Math.max(start.getTime(), min?.getTime() ?? -Infinity) / MINUTE_MS) * MINUTE_MS,
    last: Math.min(addDays(start, 1).getTime() - MINUTE_MS, max?.getTime() ?? Infinity),
  };
}

export function firstKyivTimeSlot(
  day: Date,
  step: number,
  min?: Date,
  max?: Date,
): number | undefined {
  const { first, last } = dayBounds(day, min, max);
  const interval = minuteInterval(step);
  for (let time = first; time <= last; time += MINUTE_MS) {
    if (new TZDate(time, KYIV_TIME_ZONE).getMinutes() % interval === 0) {
      return time;
    }
  }
  return undefined;
}

export function kyivTimeSlots(day: Date, step: number, min?: Date, max?: Date) {
  const { last } = dayBounds(day, min, max);
  const first = firstKyivTimeSlot(day, step, min, max);
  const interval = minuteInterval(step);
  const slots: { value: string; label: string }[] = [];
  for (let time = first ?? Infinity; time <= last; time += MINUTE_MS) {
    const date = new TZDate(time, KYIV_TIME_ZONE);
    if (date.getMinutes() % interval === 0) {
      slots.push({ value: date.toISOString(), label: format(date, 'HH:mm') });
    }
  }
  const counts = new Map<string, number>();
  for (const slot of slots) {
    counts.set(slot.label, (counts.get(slot.label) ?? 0) + 1);
  }
  return slots.map((slot) => ({
    ...slot,
    label:
      counts.get(slot.label)! > 1
        ? `${slot.label} (${format(new TZDate(slot.value, KYIV_TIME_ZONE), 'xxx')})`
        : slot.label,
  }));
}

export function selectKyivDay(
  day: Date,
  current: Date,
  step: number,
  min?: Date,
  max?: Date,
): Date | undefined {
  const selected = new TZDate(day, KYIV_TIME_ZONE);
  const previous = new TZDate(current, KYIV_TIME_ZONE);
  selected.setHours(previous.getHours(), previous.getMinutes(), 0, 0);
  const slots = kyivTimeSlots(day, step, min, max);
  const closest = slots.reduce<(typeof slots)[number] | undefined>(
    (best, slot) =>
      !best ||
      Math.abs(Date.parse(slot.value) - selected.getTime()) <
        Math.abs(Date.parse(best.value) - selected.getTime())
        ? slot
        : best,
    undefined,
  );
  return closest ? new Date(closest.value) : undefined;
}
