'use client';

import { ChevronDown, CircleSlash2 } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { DraftRenderer } from '@/components/ui/draft-renderer';
import { cn } from '@/lib/utils';
import type { FaqCategoryData, FaqItemData } from '@/types/faq';

interface FaqAccordionItemProps {
  item: FaqItemData;
  isOpen: boolean;
  onToggle: () => void;
}

function FaqAccordionItem({ item, isOpen, onToggle }: FaqAccordionItemProps) {
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
          <DraftRenderer content={item.content} />
        </div>
      )}
    </div>
  );
}

interface FaqAccordionProps {
  categories: FaqCategoryData[];
}

export function FaqAccordion({ categories }: FaqAccordionProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  if (categories.length === 0) {
    return (
      <div className="bg-[var(--surface)] flex items-center justify-center p-4">
        <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] overflow-hidden w-full max-w-md">
          <EmptyState icon={<CircleSlash2 className="w-8 h-8" />} title="FAQ поки порожній" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {categories.map((category) => (
        <section key={category.id}>
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-[var(--foreground)] mb-4 break-words">
            {category.title}
          </h2>
          <div className="space-y-2">
            {category.items.map((item) => (
              <FaqAccordionItem
                key={item.id}
                item={item}
                isOpen={openItems.has(item.id)}
                onToggle={() => toggle(item.id)}
              />
            ))}
            {category.items.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)] font-body px-1">
                Питань у цій категорії ще немає.
              </p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
