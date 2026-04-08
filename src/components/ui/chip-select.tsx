'use client';

import { cn } from '@/lib/utils/common';

interface ChipOption {
  value: string;
  label: string;
}

interface ChipSelectProps {
  options: ChipOption[];
  value: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  error?: boolean;
  className?: string;
}

export function ChipSelect({
  options,
  value,
  onChange,
  disabled,
  error,
  className,
}: ChipSelectProps) {
  function toggle(v: string) {
    if (disabled) return;
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((opt) => {
        const selected = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => toggle(opt.value)}
            className={cn(
              'font-body h-8 rounded-lg border px-3 text-sm font-medium transition-all duration-150',
              'focus-visible:ring-kpi-blue-light focus-visible:ring-2 focus-visible:outline-none',
              selected
                ? 'border-kpi-navy bg-kpi-navy shadow-shadow-sm text-white'
                : 'border-border-color text-foreground hover:border-kpi-blue-light bg-white',
              disabled && 'cursor-not-allowed opacity-50',
              error && !selected && 'border-error',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
