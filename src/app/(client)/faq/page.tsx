import type { Metadata } from 'next';

import { ErrorState } from '@/components/common/error-state';
import { FaqAccordion } from '@/components/faq/faq-accordion';
import { serverApi } from '@/lib/api/server';

export const metadata: Metadata = {
  title: 'FAQ — Часті запитання',
  description: 'Відповіді на найпоширеніші запитання про систему голосування КПІ.',
  openGraph: {
    title: 'FAQ — Часті запитання',
    description:
      'Відповіді на найпоширеніші запитання про систему голосування КПІ. Як працює анонімність, як проголосувати, хто має доступ тощо.',
    url: '/faq',
  },
};

export default async function FaqPage() {
  const { data } = await serverApi.faq.get();

  if (data === null) {
    return (
      <div className="bg-surface flex min-h-[calc(100dvh-var(--header-height))] items-center justify-center p-4">
        <div className="border-border-color shadow-shadow-sm w-full max-w-md overflow-hidden rounded-xl border bg-white">
          <ErrorState title="Помилка завантаження" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-[calc(100dvh-var(--header-height))]">
      <div className="container mx-auto max-w-3xl py-10 sm:py-16">
        <div className="mb-10 text-center sm:mb-14">
          <h1 className="font-display text-kpi-navy mb-2 text-3xl font-bold sm:mb-3 sm:text-5xl">
            Часті запитання
          </h1>
          <p className="font-body text-muted-foreground mx-auto max-w-xl text-base sm:text-lg">
            Знайдіть відповіді на найпоширеніші запитання про систему електронного голосування
          </p>
        </div>

        <FaqAccordion categories={data} />
      </div>
    </div>
  );
}
