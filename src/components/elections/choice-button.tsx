import { cn } from '@/lib/utils';
import type { ElectionChoice } from '@/types/election';

interface ChoiceButtonProps {
  choice: ElectionChoice;
  selected: boolean;
  onSelect: (choice: ElectionChoice) => void;
  index: number;
}

export function ChoiceButton({ choice, selected, onSelect, index }: ChoiceButtonProps) {
  return (
    <button
      onClick={() => onSelect(choice)}
      className={cn(
        'w-full flex items-center gap-4 p-4 rounded-[var(--radius-lg)]',
        'border-2 transition-all duration-200 text-left',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kpi-blue-light)] focus-visible:ring-offset-2',
        'animate-fade-up',
        selected
          ? 'border-[var(--kpi-navy)] bg-[var(--kpi-navy)]/5 shadow-[var(--shadow-card)]'
          : 'border-[var(--border-color)] bg-white hover:border-[var(--kpi-blue-light)]/50 hover:bg-[var(--surface)]',
      )}
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
    >
      <div
        className={cn(
          'w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all duration-200',
          selected
            ? 'border-[var(--kpi-navy)] bg-[var(--kpi-navy)]'
            : 'border-[var(--border-color)] bg-white',
        )}
      >
        {selected && <div className="w-2 h-2 rounded-full bg-white" />}
      </div>
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          'font-display text-base font-bold transition-all duration-200',
          selected
            ? 'bg-[var(--kpi-navy)] text-white'
            : 'bg-[var(--surface)] text-[var(--kpi-gray-mid)]',
        )}
      >
        {String.fromCharCode(65 + choice.position)}
      </div>
      <span
        className={cn(
          'flex-1 min-w-0 break-words font-body text-sm font-medium transition-colors duration-200',
          selected ? 'text-[var(--kpi-navy)]' : 'text-[var(--foreground)]',
        )}
      >
        {choice.choice}
      </span>
    </button>
  );
}
