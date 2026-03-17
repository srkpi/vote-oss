import { cn } from '@/lib/utils';

interface ToggleFieldProps {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}

export function ToggleField({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: ToggleFieldProps) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 group',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
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
            'w-10 h-6 rounded-full transition-all duration-200',
            checked ? 'bg-[var(--kpi-navy)]' : 'bg-[var(--border-color)]',
          )}
        >
          <div
            className={cn(
              'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200',
              checked ? 'left-5' : 'left-1',
            )}
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-[var(--foreground)] font-body">{label}</p>
        {description && (
          <p className="text-xs text-[var(--muted-foreground)] font-body mt-0.5">{description}</p>
        )}
      </div>
    </label>
  );
}
