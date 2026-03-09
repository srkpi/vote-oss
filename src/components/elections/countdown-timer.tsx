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
          'flex items-center gap-2 text-[var(--muted-foreground)] font-body text-sm',
          className,
        )}
      >
        <Clock className="w-4 h-4" />
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
    <div className={cn('flex items-center gap-3', className)}>
      {visibleUnits.map(({ value, label }, i) => (
        <div key={label} className="flex items-center gap-3">
          <div className="text-center">
            <div
              className={cn(
                'min-w-[52px] h-14 flex items-center justify-center',
                'navy-gradient rounded-[var(--radius-lg)]',
                'shadow-[var(--shadow-md)]',
              )}
            >
              <span className="font-display text-2xl font-bold text-white tabular-nums leading-none">
                {String(value).padStart(2, '0')}
              </span>
            </div>
            <span className="text-[10px] font-body text-[var(--muted-foreground)] uppercase tracking-widest mt-1.5 block">
              {label}
            </span>
          </div>
          {i < visibleUnits.length - 1 && (
            <span className="font-display text-xl font-bold text-[var(--kpi-gray-mid)] mb-4 select-none">
              :
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
