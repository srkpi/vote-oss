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
      <div className="flex min-h-[calc(100dvh-var(--header-height))] items-center justify-center bg-(--surface) p-4">
        <div className="w-full max-w-md overflow-hidden rounded-xl border border-(--border-color) bg-white shadow-(--shadow-sm)">
          <ErrorState title="Помилка завантаження" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-var(--header-height))] bg-(--surface)">
      <div className="container mx-auto max-w-3xl py-10 sm:py-16">
        <div className="mb-10 text-center sm:mb-14">
          <h1 className="font-display mb-2 text-3xl font-bold text-(--kpi-navy) sm:mb-3 sm:text-5xl">
            Часті запитання
          </h1>
          <p className="font-body mx-auto max-w-xl text-base text-(--muted-foreground) sm:text-lg">
            Знайдіть відповіді на найпоширеніші запитання про систему електронного голосування
          </p>
        </div>

        <FaqAccordion categories={data} />
      </div>
    </div>
  );
}
