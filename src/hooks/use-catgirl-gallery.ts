'use client';

import { useEffect, useMemo, useState } from 'react';

import { useCatgirlMode } from '@/hooks/use-catgirl-mode';
import { useElementWidth } from '@/hooks/use-element-width';
import { computeJustifiedGalleryLayout, type GalleryLayoutRow } from '@/lib/catgirl/gallery-layout';
import {
  claimCatgirlImages,
  ensureCatgirlImagePoolReady,
  subscribeCatgirlImagePool,
} from '@/lib/catgirl/image-pool';
import {
  CATGIRL_GALLERY_BUFFER_SIZE,
  CATGIRL_GALLERY_GAP,
  CATGIRL_GALLERY_SIZE_PRESETS,
  type CatgirlGallerySize,
} from '@/lib/constants';
import type { CatgirlImage } from '@/types/catgirl';

export interface UseCatgirlGalleryResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  rows: GalleryLayoutRow<CatgirlImage>[];
  enabled: boolean;
}

/**
 * Claims a buffer of images from the shared pool (`image-pool.ts`) and
 * runs them through `computeJustifiedGalleryLayout` against the
 * container's real measured width (`useElementWidth`), recomputing on
 * resize.
 *
 * The buffer (`CATGIRL_GALLERY_BUFFER_SIZE`) is claimed up front and kept
 * well stocked — deliberately larger than any preset's `maxImages` — so
 * the packing algorithm always has enough candidates to fill a wide
 * container's last row well, and so growing the window (or rotating a
 * tablet) can reveal more images immediately from ones already on hand
 * rather than waiting on a fresh fetch the moment more space appears.
 * That's "fetch a new portion ahead of time, not once the last image is
 * showing" applied at the gallery level; the shared pool does the
 * equivalent at the pool level (see `CATGIRL_IMAGE_POOL_REFILL_THRESHOLD`).
 */
export function useCatgirlGallery(size: CatgirlGallerySize): UseCatgirlGalleryResult {
  const { enabled } = useCatgirlMode();
  const [containerRef, containerWidth] = useElementWidth<HTMLDivElement>();
  const [images, setImages] = useState<CatgirlImage[]>([]);

  useEffect(() => {
    if (!enabled || images.length >= CATGIRL_GALLERY_BUFFER_SIZE) return;

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    // Tracked locally rather than re-read from `images` state (which
    // wouldn't reflect a same-tick update yet) — seeded from the current
    // state so a claim already on hand from before this effect ran isn't
    // asked for again.
    let heldCount = images.length;
    const seenIds = new Set(images.map((image) => image.id));

    const topUp = (): boolean => {
      const needed = CATGIRL_GALLERY_BUFFER_SIZE - heldCount;
      if (needed <= 0) return true;
      const claimed = claimCatgirlImages(needed).filter((image) => !seenIds.has(image.id));
      if (claimed.length === 0) return false;
      for (const image of claimed) seenIds.add(image.id);
      heldCount += claimed.length;
      if (!cancelled) setImages((current) => [...current, ...claimed]);
      return heldCount >= CATGIRL_GALLERY_BUFFER_SIZE;
    };

    if (!topUp()) {
      unsubscribe = subscribeCatgirlImagePool(() => {
        if (topUp() && unsubscribe) {
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

  const preset = CATGIRL_GALLERY_SIZE_PRESETS[size];
  const rows = useMemo(() => {
    if (!enabled || containerWidth === null || images.length === 0) return [];
    return computeJustifiedGalleryLayout(images, containerWidth, {
      ...preset,
      gap: CATGIRL_GALLERY_GAP,
    });
  }, [enabled, containerWidth, images, preset]);

  return { containerRef, rows, enabled };
}
