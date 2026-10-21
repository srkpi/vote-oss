'use client';

import { Heart, Loader2, PawPrint, Sparkle, Sparkles } from 'lucide-react';

import { CatgirlFeed } from '@/components/catgirl/catgirl-feed';
import { useCatgirlMode } from '@/hooks/use-catgirl-mode';

export function CatgirlShowcase() {
  const { enabled, ready } = useCatgirlMode();

  if (!ready) {
    return (
      <div
        role="status"
        aria-busy="true"
        className="flex h-80 w-full items-center justify-center rounded-3xl border-2 border-border bg-surface-hover/60 sm:h-96"
      >
        <Loader2
          className="h-9 w-9 animate-spin text-kpi-blue-light/60"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <span className="sr-only">Завантаження…</span>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="relative flex h-80 w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border-2 border-dashed border-border bg-surface-hover/60 p-6 text-center sm:h-96">
        <PawPrint className="h-9 w-9 text-kpi-blue-light/40" strokeWidth={1.5} aria-hidden="true" />
        <p className="font-body text-md max-w-88 text-kpi-navy">
          Увімкніть, щоб побачити чарівні картинки
        </p>
        <PawPrint
          className="absolute top-6 left-8 h-4 w-4 -rotate-12 text-kpi-blue-light/25"
          aria-hidden="true"
        />
        <PawPrint
          className="absolute top-14 left-16 h-3.5 w-3.5 rotate-6 text-kpi-blue-light/20"
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <div className="relative flex w-full justify-center">
      <div
        className="absolute inset-x-6 top-6 -z-10 h-96 rounded-[2.5rem] bg-linear-to-br from-pink-300/40 via-rose-300/25 to-transparent blur-2xl"
        aria-hidden="true"
      />
      <div className="relative w-full rounded-2xl border border-border/70 bg-card/90 p-4 shadow-[0_24px_60px_-24px_rgba(157,23,77,0.45)] sm:p-6">
        <CatgirlFeed />

        <Sparkles
          className="absolute -top-3 -right-3 h-8 w-8 text-pink-300 drop-shadow-sm"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <Heart
          className="absolute -bottom-3 -left-3 h-7 w-7 fill-rose-200 text-rose-300 drop-shadow-sm"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <Sparkle
          className="absolute -top-2 -left-2 h-4 w-4 fill-pink-200 text-pink-200"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
