'use client';

import { Clock } from 'lucide-react';

import { useCountdown } from '@/hooks/use-countdown';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  targetDate: string;
  className?: string;
}

export function CountdownTimer({ targetDate, className }: CountdownTimerProps) {
  const { days, hours, minutes, seconds, expired } = useCountdown(targetDate);

  if (expired) {
    return (
      <div
        className={cn(
          'font-body flex items-center gap-2 text-sm text-(--muted-foreground)',
          className,
        )}
      >
        <Clock className="h-4 w-4" />
        <span>Час минув</span>
      </div>
    );
  }

  const units = [
    { value: days, label: 'дн' },
    { value: hours, label: 'год' },
    { value: minutes, label: 'хв' },
    { value: seconds, label: 'с' },
  ];

  // Show only relevant units (e.g. if days > 0, show days+hours)
  const visibleUnits = days > 0 ? units : hours > 0 ? units.slice(1) : units.slice(2);

  return (
    <div className={cn('flex items-center gap-1 sm:gap-3', className)}>
      {visibleUnits.map(({ value, label }, i) => (
        <div key={label} className="flex items-center gap-1 sm:gap-3">
          <div className="text-center">
            <div
              className={cn(
                'flex h-14 min-w-[52px] items-center justify-center',
                'navy-gradient rounded-lg',
                'shadow-(--shadow-md)',
              )}
            >
              <span className="font-display text-2xl leading-none font-bold text-white tabular-nums">
                {String(value).padStart(2, '0')}
              </span>
            </div>
            <span className="font-body mt-1.5 block text-[10px] tracking-widest text-(--muted-foreground) uppercase">
              {label}
            </span>
          </div>
          {i < visibleUnits.length - 1 && (
            <span className="font-display mb-4 text-xl font-bold text-(--kpi-gray-mid) select-none">
              :
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
