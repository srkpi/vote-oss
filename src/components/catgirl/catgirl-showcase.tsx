'use client';

import { Sparkles } from 'lucide-react';

import { CatgirlInlineImage } from '@/components/catgirl/catgirl-inline-image';
import { useCatgirlMode } from '@/hooks/use-catgirl-mode';

export function CatgirlShowcase() {
  const { enabled } = useCatgirlMode();

  if (!enabled) {
    return (
      <div className="bg-card flex h-80 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-2 text-center sm:h-96">
        <p className="font-body text-md text-kpi-navy">Увімкніть, щоб побачити чарівну картинку</p>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <CatgirlInlineImage size="lg" />
      <Sparkles className="absolute -top-3 -right-3 h-8 w-8 text-pink-300" strokeWidth={1.5} />
      <Sparkles className="absolute -bottom-3 -left-3 h-8 w-8 text-pink-300" strokeWidth={1.5} />
    </div>
  );
}
