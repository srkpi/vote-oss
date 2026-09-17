'use client';

import { useEffect, useState } from 'react';

import { useCatgirlMode } from '@/hooks/use-catgirl-mode';
import {
  claimNextCatgirlImage,
  ensureCatgirlImagePoolReady,
  subscribeCatgirlImagePool,
} from '@/lib/catgirl/image-pool';
import type { CatgirlImage } from '@/types/catgirl';

export function useCatgirlImage(): CatgirlImage | null {
  const { enabled } = useCatgirlMode();
  const [image, setImage] = useState<CatgirlImage | null>(null);

  useEffect(() => {
    if (!enabled || image) return;

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const tryClaim = (): boolean => {
      const next = claimNextCatgirlImage();
      if (!next) return false;
      if (!cancelled) setImage(next);
      return true;
    };

    if (!tryClaim()) {
      unsubscribe = subscribeCatgirlImagePool(() => {
        if (tryClaim() && unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
      });
      ensureCatgirlImagePoolReady();
    }

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return enabled ? image : null;
}
