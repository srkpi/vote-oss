import { cn } from '@/lib/utils/common';

interface ToggleFieldProps {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  className?: string;
}

export function ToggleField({
  label,
  description,
  checked,
  className,
  disabled = false,
  onChange,
}: ToggleFieldProps) {
  return (
    <label
      className={cn(
        'group flex items-start gap-3',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        className,
      )}
    >
      <div className="relative mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />

        <div
          className={cn(
            'h-6 w-10 rounded-full transition-all duration-200',
            checked ? 'bg-kpi-navy' : 'bg-border',
          )}
        >
          <div
            className={cn(
              'absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all duration-200',
              checked ? 'left-5' : 'left-1',
            )}
          />
        </div>
      </div>

      <div>
        <p className="font-body text-foreground text-sm font-medium">{label}</p>
        {description && (
          <p className="font-body text-muted-foreground mt-0.5 text-xs">{description}</p>
        )}
      </div>
    </label>
  );
}
