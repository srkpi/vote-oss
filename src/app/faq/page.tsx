import type { Metadata } from 'next';

import { ErrorState } from '@/components/common/error-state';
import { FaqAccordion } from '@/components/faq/faq-accordion';
import { serverApi } from '@/lib/api/server';

export const metadata: Metadata = {
  title: 'FAQ — Часті запитання',
  description: 'Відповіді на найпоширеніші запитання про систему голосування КПІ.',
};

export default async function FaqPage() {
  const { data } = await serverApi.getFaq();

  if (data === null) {
    return (
      <div className="min-h-[calc(100dvh-var(--header-height))] bg-[var(--surface)] flex items-center justify-center p-4">
        <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] overflow-hidden w-full max-w-md">
          <ErrorState title="Помилка завантаження" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-var(--header-height))] bg-[var(--surface)]">
      <div className="container py-10 sm:py-16 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-10 sm:mb-14 text-center">
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-[var(--kpi-navy)] mb-3">
            Часті запитання
          </h1>
          <p className="text-[var(--muted-foreground)] font-body text-base sm:text-lg max-w-xl mx-auto">
            Знайдіть відповіді на найпоширеніші запитання про систему електронного голосування
          </p>
        </div>

        <FaqAccordion categories={data} />
      </div>
    </div>
  );
}
