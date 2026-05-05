import { CheckIcon } from 'lucide-react';

import { cn } from '@/lib/utils/common';
import type { ElectionChoice } from '@/types/election';

interface ChoiceButtonProps {
  choice: ElectionChoice;
  selected: boolean;
  onSelect: (choice: ElectionChoice) => void;
  onDeselect: (choice: ElectionChoice) => void;
  index: number;
  multiple?: boolean;
  disabled?: boolean;
}

export function ChoiceButton({
  choice,
  selected,
  onSelect,
  onDeselect,
  index,
  multiple = false,
  disabled = false,
}: ChoiceButtonProps) {
  function handleClick() {
    if (disabled) return;
    if (selected) {
      if (multiple) onDeselect(choice);
    } else {
      onSelect(choice);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-4 rounded-lg p-4',
        'border-2 text-left transition-all duration-200',
        'focus-visible:ring-kpi-blue-light focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        'animate-fade-up ph-no-capture',
        selected
          ? 'border-kpi-navy bg-kpi-navy/5 shadow-shadow-card'
          : 'border-border-color hover:border-kpi-blue-light/50 hover:bg-surface bg-white',
        disabled && !selected && 'cursor-not-allowed opacity-50',
      )}
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
    >
      {multiple ? (
        <div
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all duration-200',
            selected ? 'border-kpi-navy bg-kpi-navy' : 'border-border-color bg-white',
          )}
        >
          {selected && <CheckIcon color="white" className="h-4 w-4" />}
        </div>
      ) : (
        <div
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200',
            selected ? 'border-kpi-navy bg-kpi-navy' : 'border-border-color bg-white',
          )}
        >
          {selected && <div className="h-2 w-2 rounded-full bg-white" />}
        </div>
      )}

      <span
        className={cn(
          'font-body min-w-0 flex-1 text-sm font-medium wrap-break-word',
          'ph-mask transition-colors duration-200',
          selected ? 'text-kpi-navy' : 'text-foreground',
        )}
      >
        {choice.choice}
      </span>
    </button>
  );
}
