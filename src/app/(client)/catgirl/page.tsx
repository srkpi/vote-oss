import { Cat } from 'lucide-react';
import type { Metadata } from 'next';

import { CatgirlModeToggle } from '@/components/catgirl/catgirl-mode-toggle';
import { CatgirlShowcase } from '@/components/catgirl/catgirl-showcase';

export const metadata: Metadata = {
  title: 'Catgirl-режим',
  description: 'Секретний режим платформи',
  robots: { index: false, follow: false },
};

export default function CatgirlPage() {
  return (
    <div className="catgirl bg-surface min-h-[calc(100vh-var(--header-height))]">
      <div className="container flex max-w-3xl flex-col items-center justify-center gap-8 py-12 sm:py-16">
        <div className="flex flex-col items-center text-center">
          <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-pink-400 to-rose-500 shadow-[0_12px_32px_-8px_rgba(219,39,119,0.5)]">
            <Cat className="h-10 w-10 text-white" strokeWidth={1.75} />
          </span>
          <h1 className="font-display text-kpi-navy text-3xl font-bold sm:text-4xl">
            Catgirl-режим
          </h1>
        </div>

        <CatgirlModeToggle />
        <CatgirlShowcase />
      </div>
    </div>
  );
}
