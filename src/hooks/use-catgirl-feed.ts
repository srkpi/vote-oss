'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useElementWidth } from '@/hooks/use-element-width';
import {
  computeJustifiedGalleryLayout,
  type GalleryLayoutOptions,
  type GalleryLayoutRow,
} from '@/lib/catgirl/gallery-layout';
import { claimCatgirlImages, subscribeCatgirlImagePool } from '@/lib/catgirl/image-pool';
import {
  CATGIRL_FEED_BATCH_SIZE,
  CATGIRL_FEED_PREFETCH_MARGIN_PX,
  CATGIRL_FEED_STALL_TIMEOUT_MS,
  CATGIRL_GALLERY_GAP,
  CATGIRL_GALLERY_SIZE_PRESETS,
} from '@/lib/constants';
import type { CatgirlImage } from '@/types/catgirl';

/**
 * Same row look as the `lg` gallery, minus its image/row budget, and with the
 * unfinished last row held back (see `trailingRow` in `gallery-layout.ts`) so
 * rows already on screen never change when a new batch arrives.
 */
const FEED_LAYOUT_OPTIONS: GalleryLayoutOptions = {
  ...CATGIRL_GALLERY_SIZE_PRESETS.lg,
  gap: CATGIRL_GALLERY_GAP,
  maxImages: Number.POSITIVE_INFINITY,
  maxRows: Number.POSITIVE_INFINITY,
  trailingRow: 'hold',
};

export interface UseCatgirlFeedResult {
  /** Attach to the element the rows are laid out inside — its width drives the layout. */
  containerRef: React.RefCallback<HTMLDivElement>;
  /** Attach to an element placed *after* the rows; nearing the viewport loads the next batch. */
  sentinelRef: React.RefCallback<HTMLDivElement>;
  rows: GalleryLayoutRow<CatgirlImage>[];
  /** The pool stayed empty for `CATGIRL_FEED_STALL_TIMEOUT_MS`; loading is paused until `retry`. */
  stalled: boolean;
  retry: () => void;
}

/**
 * Endless scroll on top of the shared image pool (`image-pool.ts`): every
 * time the sentinel scrolls within `CATGIRL_FEED_PREFETCH_MARGIN_PX` of the
 * viewport, another `CATGIRL_FEED_BATCH_SIZE` images are claimed and appended
 * to the layout. The pool keeps itself stocked in the background (see
 * `CATGIRL_IMAGE_POOL_REFILL_THRESHOLD`), so a batch is normally available
 * instantly; only when the user scrolls faster than the API can keep up does
 * the feed have to wait on a refill.
 *
 * Nothing is loaded up front — the first batch is requested the same way as
 * every later one, because the sentinel is already in view on first render.
 * Unlike `useCatgirlGallery` this hook doesn't read the mode itself: it's
 * meant to be mounted only while catgirl mode is on (see `CatgirlShowcase`).
 */
export function useCatgirlFeed(): UseCatgirlFeedResult {
  const [containerRef, containerWidth] = useElementWidth<HTMLDivElement>();
  // In state rather than a plain ref so the observer effect below re-runs
  // when the sentinel element actually appears.
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);
  const [images, setImages] = useState<CatgirlImage[]>([]);
  const [stalled, setStalled] = useState(false);

  // Every id ever appended. Images are keyed by id, and the pool only dedupes
  // against what it still holds — an already-claimed id can come around again
  // after a refill.
  const seenIdsRef = useRef<Set<string>>(new Set());
  // Set while waiting on an empty pool: calling it stops the wait. Doubles as
  // the "a wait is already in flight" flag so overlapping triggers are no-ops.
  const cancelWaitRef = useRef<(() => void) | null>(null);

  /** Claims one batch from the pool. `false` if the pool had nothing new to give. */
  const takeImages = useCallback((): boolean => {
    let claimed = claimCatgirlImages(CATGIRL_FEED_BATCH_SIZE);
    while (claimed.length > 0) {
      const fresh = claimed.filter((image) => {
        if (seenIdsRef.current.has(image.id)) return false;
        seenIdsRef.current.add(image.id);
        return true;
      });
      if (fresh.length > 0) {
        setImages((current) => [...current, ...fresh]);
        return true;
      }
      claimed = claimCatgirlImages(CATGIRL_FEED_BATCH_SIZE);
    }
    return false;
  }, []);

  const loadMore = useCallback(() => {
    if (cancelWaitRef.current) return;
    if (takeImages()) return;

    // The pool is empty — the failed claim above has already kicked off a
    // refill. Wait for it to land rather than polling, and give up after a
    // while so a dead API ends in a retry button instead of a spinner forever.
    let unsubscribe: (() => void) | null = null;
    let stallTimer: ReturnType<typeof setTimeout> | null = null;

    const stopWaiting = () => {
      unsubscribe?.();
      unsubscribe = null;
      if (stallTimer !== null) clearTimeout(stallTimer);
      stallTimer = null;
      cancelWaitRef.current = null;
    };

    unsubscribe = subscribeCatgirlImagePool(() => {
      if (takeImages()) stopWaiting();
    });
    stallTimer = setTimeout(() => {
      stopWaiting();
      setStalled(true);
    }, CATGIRL_FEED_STALL_TIMEOUT_MS);
    cancelWaitRef.current = stopWaiting;
  }, [takeImages]);

  const retry = useCallback(() => {
    setStalled(false);
    loadMore();
  }, [loadMore]);

  useEffect(() => () => cancelWaitRef.current?.(), []);

  const hasWidth = Boolean(containerWidth);

  useEffect(() => {
    // Nothing to lay out against yet, or loading is paused until `retry`.
    if (!sentinel || !hasWidth || stalled) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: `0px 0px ${CATGIRL_FEED_PREFETCH_MARGIN_PX}px 0px` },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // `images.length` is a dependency on purpose, although the effect never
    // reads it: an observer only reports *changes* in intersection, so if a
    // batch lands and the sentinel is still inside the margin (a tall screen,
    // or a batch that only completed a held row) nothing would fire again.
    // A fresh observer reports the current state straight away, which is what
    // keeps the feed filling until the sentinel is pushed out of range.
  }, [sentinel, hasWidth, stalled, images.length, loadMore]);

  const rows = useMemo(() => {
    if (!containerWidth || images.length === 0) return [];
    return computeJustifiedGalleryLayout(images, containerWidth, FEED_LAYOUT_OPTIONS);
  }, [containerWidth, images]);

  return { containerRef, sentinelRef: setSentinel, rows, stalled, retry };
}
