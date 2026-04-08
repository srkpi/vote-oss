import { Search, X } from 'lucide-react';

import { cn } from '@/lib/utils/common';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Пошук...',
  className,
}: SearchInputProps) {
  return (
    <div className={cn('relative w-full flex-1', className)}>
      <div className="text-kpi-gray-mid pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
        <Search className="h-4 w-4" />
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'font-body h-9 w-full pr-3 pl-9 text-sm',
          'border-border-color rounded-lg border bg-white',
          'placeholder:text-subtle',
          'focus:border-kpi-blue-light focus:ring-kpi-blue-light/20 focus:ring-2 focus:outline-none',
          'shadow-shadow-xs transition-colors duration-150',
        )}
      />

      {value && (
        <button
          onClick={() => onChange('')}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
