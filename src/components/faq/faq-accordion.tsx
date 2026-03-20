'use client';

import { CircleSlash2 } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { FaqAccordionItem } from '@/components/faq/faq-accordion-item';
import type { FaqCategoryData } from '@/types/faq';

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
      <div className="bg-surface flex items-center justify-center p-4">
        <div className="border-border-color shadow-shadow-sm w-full max-w-md overflow-hidden rounded-xl border bg-white">
          <EmptyState icon={<CircleSlash2 className="h-8 w-8" />} title="FAQ поки порожній" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
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
