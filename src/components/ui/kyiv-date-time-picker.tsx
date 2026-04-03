import { format, fromZonedTime, toZonedTime } from 'date-fns-tz';
import * as React from 'react';

import type { InputProps } from '@/components/ui/form';
import { Input } from '@/components/ui/form';

const KYIV_TZ = 'Europe/Kyiv';

/**
 * Convert a UTC Date → "YYYY-MM-DDTHH:mm" string displayed in Kyiv time.
 * date-fns-tz toZonedTime shifts the date to Kyiv wall-clock time,
 * then format prints it as a naive local string for the input.
 */
function utcToKyivInputValue(utcDate: Date): string {
  const kyivDate = toZonedTime(utcDate, KYIV_TZ);
  return format(kyivDate, "yyyy-MM-dd'T'HH:mm", { timeZone: KYIV_TZ });
}

/**
 * Convert a "YYYY-MM-DDTHH:mm" string (treated as Kyiv wall-clock time) → UTC Date.
 * date-fns-tz fromZonedTime interprets the naive string as Kyiv time and
 * returns the correct UTC Date, DST-aware.
 */
function kyivInputValueToUtcDate(value: string): Date {
  return fromZonedTime(value, KYIV_TZ);
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export interface KyivDateTimePickerProps extends Omit<
  InputProps,
  'type' | 'value' | 'onChange' | 'min' | 'max'
> {
  value: Date | string | null | undefined;
  onChange: (utcDate: Date) => void;
  min?: Date | string;
  max?: Date | string;
}

export const KyivDateTimePicker = React.forwardRef<HTMLInputElement, KyivDateTimePickerProps>(
  ({ value, onChange, min, max, ...props }, ref) => {
    const utcDate = toDate(value);
    const inputValue = utcDate ? utcToKyivInputValue(utcDate) : '';

    const minDate = toDate(min);
    const maxDate = toDate(max);
    const inputMin = minDate ? utcToKyivInputValue(minDate) : undefined;
    const inputMax = maxDate ? utcToKyivInputValue(maxDate) : undefined;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.value) return;
      const utc = kyivInputValueToUtcDate(e.target.value);
      onChange(utc);
    };

    return (
      <Input
        ref={ref}
        type="datetime-local"
        value={inputValue}
        onChange={handleChange}
        min={inputMin}
        max={inputMax}
        {...props}
      />
    );
  },
);
KyivDateTimePicker.displayName = 'KyivDateTimePicker';
