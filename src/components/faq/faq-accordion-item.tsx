import { ChevronDown } from 'lucide-react';

import { QuillRenderer } from '@/components/ui/quill/quill-renderer';
import { cn } from '@/lib/utils';
import type { FaqItemData } from '@/types/faq';

interface FaqAccordionItemProps {
  item: FaqItemData;
  isOpen: boolean;
  onToggle: () => void;
}

export function FaqAccordionItem({ item, isOpen, onToggle }: FaqAccordionItemProps) {
  return (
    <div
      className={cn(
        'border border-[var(--border-color)] rounded-[var(--radius-lg)] overflow-hidden',
        'transition-shadow duration-200',
        isOpen && 'shadow-[var(--shadow-card)]',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={cn(
          'w-full flex items-center justify-between gap-3',
          'px-4 sm:px-5 py-3.5 sm:py-4',
          'text-left font-body font-medium text-sm sm:text-base text-[var(--foreground)]',
          'bg-white hover:bg-[var(--surface)] transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--kpi-blue-light)]',
        )}
      >
        <span className="flex-1 min-w-0 break-words">{item.title}</span>
        <ChevronDown
          className={cn(
            'w-4 h-4 shrink-0 text-[var(--muted-foreground)] transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && (
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-[var(--border-subtle)] bg-white">
          <QuillRenderer content={item.content} />
        </div>
      )}
    </div>
  );
}
