'use client';

import { useState } from 'react';

import { CatgirlAttribution } from '@/components/catgirl/catgirl-attribution';
import { CatgirlLightbox } from '@/components/catgirl/catgirl-lightbox';
import { useCatgirlGallery } from '@/hooks/use-catgirl-gallery';
import type { GalleryLayoutBox } from '@/lib/catgirl/gallery-layout';
import { CATGIRL_GALLERY_GAP, CATGIRL_GALLERY_SIZE_PRESETS } from '@/lib/constants';
import { cn } from '@/lib/utils/common';
import type { CatgirlImage } from '@/types/catgirl';

interface CatgirlGalleryProps {
  size?: keyof typeof CATGIRL_GALLERY_SIZE_PRESETS;
  className?: string;
  /** Passed straight to every `<img>`. Default `lazy` fits the common case
   *  of a gallery placed further down a page or repeated across a list of
   *  cards; pass `eager` for a gallery that *is* a page's primary content
   *  and should start fetching immediately (see `CatgirlShowcase`). */
  loading?: 'lazy' | 'eager';
}

/**
 * Packs 1–5 claimed images into one or two justified rows (see
 * `gallery-layout.ts` for the packing algorithm) instead of showing a
 * single image alone in a fixed box. Vertical images — most of what the
 * API returns — end up several to a row instead of one narrow strip in a
 * wide container; the same algorithm just as naturally puts a single wide
 * image alone, or a lone image full-width on a mobile-size container, with
 * no separate breakpoint-specific logic here. Renders nothing while
 * catgirl mode is off, so it drops into any of its call sites the same way
 * a single conditional image component would.
 */
export function CatgirlGallery({ size = 'lg', className, loading = 'lazy' }: CatgirlGalleryProps) {
  const { containerRef, rows, enabled } = useCatgirlGallery(size);
  const preset = CATGIRL_GALLERY_SIZE_PRESETS[size];
  // Keyed by image id rather than owned by each box's own component: a
  // resize can move an image from one row to another, which (since each
  // row is its own flex container) unmounts and remounts the box even
  // though it's the same image — tracking status here instead means the
  // remounted box already knows it's loaded and skips straight to fully
  // visible, rather than replaying its fade-in for an image that's
  // already on screen and cached.
  const [imageStatus, setImageStatus] = useState<Record<string, 'loaded' | 'error'>>({});

  if (!enabled) return null;

  return (
    <div className="flex w-full justify-center">
      <div ref={containerRef} className={cn('w-full', preset.maxWidthClassName, className)}>
        {rows.length === 0 ? (
          // Images (or the container's own width) haven't landed yet — a
          // skeleton roughly the size the first row will end up rather than
          // nothing, so the page doesn't jump from empty to full-sized the
          // moment they do.
          <div
            className="bg-surface-hover w-full animate-pulse rounded-2xl"
            style={{ height: preset.targetHeight }}
            aria-hidden
          />
        ) : (
          <div className="flex flex-col" style={{ gap: CATGIRL_GALLERY_GAP }}>
            {rows.map((row, rowIndex) => (
              <div
                key={rowIndex}
                className="flex justify-center"
                style={{ gap: CATGIRL_GALLERY_GAP }}
              >
                {row.boxes.map((box) => (
                  <CatgirlGalleryImage
                    key={box.item.id}
                    box={box}
                    status={imageStatus[box.item.id]}
                    loading={loading}
                    onLoad={() =>
                      setImageStatus((current) => ({ ...current, [box.item.id]: 'loaded' }))
                    }
                    onError={() =>
                      setImageStatus((current) => ({ ...current, [box.item.id]: 'error' }))
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CatgirlGalleryImage({
  box,
  status,
  loading,
  onLoad,
  onError,
}: {
  box: GalleryLayoutBox<CatgirlImage>;
  status: 'loaded' | 'error' | undefined;
  loading: 'lazy' | 'eager';
  onLoad: () => void;
  onError: () => void;
}) {
  const { item: image } = box;
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <figure
      className="relative z-10 shrink-0 overflow-hidden rounded-2xl shadow-[0_8px_24px_-12px_rgba(157,23,77,0.35)] transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-14px_rgba(157,23,77,0.45)]"
      style={{ width: box.width, height: box.height }}
    >
      <div className="absolute inset-0" style={{ backgroundColor: image.color }} aria-hidden />
      {status !== 'error' && (
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className={cn(
            'absolute inset-0 block h-full w-full cursor-zoom-in',
            'focus-visible:ring-kpi-blue-light focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
          )}
          aria-label="Переглянути зображення на весь екран"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt="Catgirl"
            loading={loading}
            className={cn(
              'h-full w-full object-contain object-center transition-opacity duration-500',
              status === 'loaded' ? 'opacity-100' : 'opacity-0',
            )}
            onLoad={onLoad}
            onError={onError}
          />
        </button>
      )}
      <CatgirlAttribution image={image} />
      {lightboxOpen && <CatgirlLightbox image={image} onClose={() => setLightboxOpen(false)} />}
    </figure>
  );
}
