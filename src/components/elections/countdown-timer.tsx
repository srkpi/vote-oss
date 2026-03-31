'use client';

import { Clock } from 'lucide-react';

import { useCountdown } from '@/hooks/use-countdown';
import { useHydration } from '@/hooks/use-hydration';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  targetDate: string;
  className?: string;
}

function BlankTimerSkeleton({ className }: { className?: string }) {
  const skeletonUnits = ['год', 'хв', 'с'];

  return (
    <div className={cn('invisible flex items-center gap-1 sm:gap-3', className)} aria-hidden="true">
      {skeletonUnits.map((label, i) => (
        <div key={label} className="flex items-center gap-1 sm:gap-3">
          <div className="text-center">
            <div className="flex h-14 min-w-13 items-center justify-center">
              <span className="font-display text-2xl leading-none font-bold tabular-nums">00</span>
            </div>
            <span className="font-body mt-1.5 block text-[10px] tracking-widest uppercase">
              {label}
            </span>
          </div>
          {i < skeletonUnits.length - 1 && (
            <span className="font-display mb-4 text-xl font-bold">:</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function CountdownTimer({ targetDate, className }: CountdownTimerProps) {
  const isHydrated = useHydration();
  const { days, hours, minutes, seconds, expired } = useCountdown(targetDate);

  if (!isHydrated) {
    return <BlankTimerSkeleton className={className} />;
  }

  if (expired) {
    return (
      <div
        className={cn(
          'font-body text-muted-foreground flex items-center gap-2 text-sm',
          'animate-in fade-in duration-500 ease-out',
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

  const visibleUnits = days > 0 ? units : hours > 0 ? units.slice(1) : units.slice(2);

  return (
    <div
      className={cn(
        'flex items-center gap-1 sm:gap-3',
        'animate-in fade-in zoom-in-95 duration-500 ease-out',
        className,
      )}
    >
      {visibleUnits.map(({ value, label }, i) => (
        <div key={label} className="flex items-center gap-1 sm:gap-3">
          <div className="text-center">
            <div
              className={cn(
                'flex h-14 min-w-13 items-center justify-center',
                'navy-gradient rounded-lg',
                'shadow-shadow-md',
              )}
            >
              <span className="font-display text-2xl leading-none font-bold text-white tabular-nums">
                {String(value).padStart(2, '0')}
              </span>
            </div>
            <span className="font-body text-muted-foreground mt-1.5 block text-[10px] tracking-widest uppercase">
              {label}
            </span>
          </div>
          {i < visibleUnits.length - 1 && (
            <span className="font-display text-kpi-gray-mid mb-4 text-xl font-bold select-none">
              :
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
