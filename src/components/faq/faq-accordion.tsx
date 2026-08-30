'use client';

import { useState } from 'react';

import { FaqAccordionItem } from '@/components/faq/faq-accordion-item';
import { cn } from '@/lib/utils/common';
import type { FaqCategoryData } from '@/types/faq';

interface FaqAccordionProps {
  categories: FaqCategoryData[];
  className?: string;
}

export function FaqAccordion({ categories, className }: FaqAccordionProps) {
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

  return (
    <div className={cn('space-y-10', className)}>
      {categories.map((category) => (
        <section key={category.id}>
          <h2 className="font-display text-foreground mb-4 text-xl font-semibold wrap-break-word sm:text-2xl">
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
              <p className="font-body text-muted-foreground px-1 text-sm">
                Питань у цій категорії ще немає.
              </p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
