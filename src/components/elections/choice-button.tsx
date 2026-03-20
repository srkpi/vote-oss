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
        'flex w-full items-center gap-4 rounded-lg p-4',
        'border-2 text-left transition-all duration-200',
        'focus-visible:ring-2 focus-visible:ring-(--kpi-blue-light) focus-visible:ring-offset-2 focus-visible:outline-none',
        'animate-fade-up',
        selected
          ? 'border-(--kpi-navy) bg-(--kpi-navy)/5 shadow-(--shadow-card)'
          : 'border-(--border-color) bg-white hover:border-(--kpi-blue-light)/50 hover:bg-(--surface)',
      )}
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
    >
      <div
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200',
          selected ? 'border-(--kpi-navy) bg-(--kpi-navy)' : 'border-(--border-color) bg-white',
        )}
      >
        {selected && <div className="h-2 w-2 rounded-full bg-white" />}
      </div>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          'font-display text-base font-bold transition-all duration-200',
          selected ? 'bg-(--kpi-navy) text-white' : 'bg-(--surface) text-(--kpi-gray-mid)',
        )}
      >
        {String.fromCharCode(65 + choice.position)}
      </div>
      <span
        className={cn(
          'font-body min-w-0 flex-1 text-sm font-medium wrap-break-word transition-colors duration-200',
          selected ? 'text-(--kpi-navy)' : 'text-(--foreground)',
        )}
      >
        {choice.choice}
      </span>
    </button>
  );
}
