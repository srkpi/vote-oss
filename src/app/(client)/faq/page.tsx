import type { Metadata } from 'next';

import { BuildInfo } from '@/components/common/build-info';
import { ErrorState } from '@/components/common/error-state';
import { FaqAccordion } from '@/components/faq/faq-accordion';
import { serverApi } from '@/lib/api/server';
import { APP_NAME, APP_URL } from '@/lib/config/client';
import { OPENGRAPH_IMAGE_DATA } from '@/lib/utils/metadata';

export const metadata: Metadata = {
  title: 'FAQ — Часті запитання',
  description: 'Відповіді на найпоширеніші запитання про платформу голосування',
  openGraph: {
    title: `FAQ — Часті запитання | ${APP_NAME}`,
    description: 'Відповіді на найпоширеніші запитання про платформу голосування',
    url: new URL('/faq', APP_URL),
    images: [OPENGRAPH_IMAGE_DATA],
  },
  twitter: {
    card: 'summary_large_image',
    title: `FAQ — Часті запитання | ${APP_NAME}`,
    description: 'Відповіді на найпоширеніші запитання про платформу голосування',
    images: [OPENGRAPH_IMAGE_DATA],
  },
};

export default async function FaqPage() {
  const { data } = await serverApi.faq.get();

  if (data === null) {
    return (
      <div className="flex min-h-[calc(100dvh-var(--header-height))] items-center justify-center bg-surface p-4">
        <div className="border-border-color w-full max-w-md overflow-hidden rounded-xl border bg-card shadow-sm">
          <ErrorState title="Помилка завантаження" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-var(--header-height))] bg-surface">
      <div className="container mx-auto max-w-3xl py-10 sm:py-16">
        <div className="text-center">
          <h1 className="mb-2 font-display text-3xl font-bold text-kpi-navy sm:mb-3 sm:text-5xl">
            Часті запитання
          </h1>
          <p className="font-body mx-auto max-w-xl text-base text-muted-foreground sm:text-lg">
            Знайдіть відповіді на найпоширеніші запитання про систему електронного голосування
          </p>
        </div>

        <FaqAccordion categories={data} className="mt-10 sm:mt-14" />
        <BuildInfo className="mt-10 sm:mt-14" />
      </div>
    </div>
  );
}
