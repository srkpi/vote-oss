'use client';

import { type ComponentProps } from 'react';
import { DayPicker } from 'react-day-picker';

import { cn } from '@/lib/utils/common';

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  fixedWeeks = true,
  navLayout = 'around',
  ...props
}: ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      fixedWeeks={fixedWeeks}
      navLayout={navLayout}
      className={cn('font-body text-sm text-foreground', className)}
      classNames={{
        root: 'w-full',
        months: 'w-full',
        month: 'relative',
        month_caption: 'flex h-10 items-center justify-center border-b border-border-subtle px-10',
        caption_label: 'font-semibold capitalize',
        button_previous:
          'absolute left-3 top-2 flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-surface',
        button_next:
          'absolute right-3 top-2 flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-surface',
        chevron: 'h-3.5 w-3.5 fill-current',
        month_grid: 'mx-auto mt-2 mb-3 w-[calc(100%-1.5rem)] table-fixed border-collapse',
        weekday: 'h-8 text-xs font-normal capitalize text-muted-foreground',
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
        ...classNames,
      }}
      {...props}
    />
  );
}
