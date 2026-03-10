import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--kpi-gray-mid)] pointer-events-none">
        <Search className="w-4 h-4" />
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full h-9 pl-9 pr-3 text-sm font-body',
          'bg-white border border-[var(--border-color)] rounded-[var(--radius-lg)]',
          'placeholder:text-[var(--subtle)]',
          'focus:outline-none focus:border-[var(--kpi-blue-light)] focus:ring-2 focus:ring-[var(--kpi-blue-light)]/20',
          'transition-colors duration-150 shadow-[var(--shadow-xs)]',
        )}
      />

      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
