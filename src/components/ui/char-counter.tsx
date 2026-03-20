import { CHAR_COUNTER_THRESHOLD } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface CharCounterProps {
  value: string | number;
  max: number;
  className?: string;
  threshold?: number;
}

export function CharCounter({
  value,
  max,
  className,
  threshold = CHAR_COUNTER_THRESHOLD,
}: CharCounterProps) {
  const used = typeof value === 'string' ? value.length : value;
  const remaining = max - used;
  const ratio = used / max;

  if (ratio < threshold) return null;

  const isOver = remaining < 0;

  return (
    <span
      className={cn(
        'text-xs font-body tabular-nums',
        isOver ? 'text-[var(--error)] font-semibold' : 'text-[var(--muted-foreground)]',
        className,
      )}
      aria-live="polite"
    >
      {isOver ? `−${Math.abs(remaining)}` : remaining}
    </span>
  );
}
