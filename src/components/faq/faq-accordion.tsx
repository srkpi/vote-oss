'use client';

import { ChevronDown, CircleSlash2 } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { cn } from '@/lib/utils';

export interface FaqItemData {
  id: string;
  title: string;
  content: string;
  position: number;
}

export interface FaqCategoryData {
  id: string;
  title: string;
  position: number;
  items: FaqItemData[];
}

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
        <span className="flex-1 min-w-0">{item.title}</span>
        <ChevronDown
          className={cn(
            'w-4 h-4 shrink-0 text-[var(--muted-foreground)] transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && (
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-[var(--border-subtle)] bg-white">
          <div
            className={cn(
              'text-sm font-body text-[var(--foreground)]/80 leading-relaxed',
              'prose-sm max-w-none',
              '[&_strong]:font-semibold [&_strong]:text-[var(--foreground)]',
              '[&_em]:italic',
              '[&_u]:underline',
              '[&_a]:text-[var(--kpi-blue-light)] [&_a]:underline [&_a]:hover:text-[var(--kpi-blue-dark)]',
              '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5',
              '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5',
              '[&_li]:my-0.5',
              '[&_hr]:border-[var(--border-color)] [&_hr]:my-3',
              '[&_p]:mb-2 [&_p:last-child]:mb-0',
            )}
            dangerouslySetInnerHTML={{ __html: item.content }}
          />
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
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-[var(--foreground)] mb-4">
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
