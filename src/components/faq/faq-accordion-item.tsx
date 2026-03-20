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
        'border-border-color overflow-hidden rounded-lg border',
        'transition-shadow duration-200',
        isOpen && 'shadow-shadow-card',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={cn(
          'flex w-full items-center justify-between gap-3',
          'px-4 py-3.5 sm:px-5 sm:py-4',
          'font-body text-foreground text-left text-sm font-medium sm:text-base',
          'hover:bg-surface bg-white transition-colors duration-150',
          'focus-visible:ring-kpi-blue-light focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
        )}
      >
        <span className="min-w-0 flex-1 wrap-break-word">{item.title}</span>
        <ChevronDown
          className={cn(
            'text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && (
        <div className="border-border-subtle border-t bg-white px-4 py-3 sm:px-5 sm:py-4">
          <QuillRenderer content={item.content} />
        </div>
      )}
    </div>
  );
}
