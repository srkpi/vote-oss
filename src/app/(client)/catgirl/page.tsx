import { Cat, Sparkle } from 'lucide-react';
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
    <div className="catgirl bg-surface relative min-h-[calc(100vh-var(--header-height))] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-pink-300/30 blur-3xl" />
        <div className="absolute top-1/4 -right-28 h-96 w-96 rounded-full bg-rose-300/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-fuchsia-200/25 blur-3xl" />
      </div>

      <div className="container flex max-w-3xl flex-col items-center justify-center gap-8 py-12 sm:py-16">
        <div className="flex flex-col items-center text-center">
          <span className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-pink-400 to-rose-500 shadow-[0_12px_32px_-8px_rgba(219,39,119,0.5)]">
            <span
              className="absolute -inset-2 rounded-full ring-2 ring-pink-300/50"
              aria-hidden="true"
            />
            <Cat className="h-10 w-10 text-white" strokeWidth={1.75} />
            <Sparkle
              className="absolute -top-1.5 -right-1.5 h-5 w-5 fill-pink-100 text-pink-100 drop-shadow-sm"
              aria-hidden="true"
            />
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
