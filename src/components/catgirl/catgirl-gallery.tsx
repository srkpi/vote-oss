'use client';

import { useState } from 'react';

import { CatgirlAttribution } from '@/components/catgirl/catgirl-attribution';
import { useCatgirlGallery } from '@/hooks/use-catgirl-gallery';
import type { GalleryLayoutBox } from '@/lib/catgirl/gallery-layout';
import { CATGIRL_GALLERY_GAP, CATGIRL_GALLERY_SIZE_PRESETS } from '@/lib/constants';
import { cn } from '@/lib/utils/common';
import type { CatgirlImage } from '@/types/catgirl';

interface CatgirlGalleryProps {
  size?: keyof typeof CATGIRL_GALLERY_SIZE_PRESETS;
  className?: string;
  /** Link each image's attribution chip to the artist's profile/source.
   *  Turn off wherever the gallery already sits inside its own `<a>`/
   *  `<Link>` (a card, say) — nested anchors are invalid HTML and Next's
   *  `Link` doesn't handle them gracefully. */
  linkAttribution?: boolean;
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
export function CatgirlGallery({
  size = 'lg',
  className,
  linkAttribution = true,
  loading = 'lazy',
}: CatgirlGalleryProps) {
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
                    linkAttribution={linkAttribution}
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
  linkAttribution,
  loading,
  onLoad,
  onError,
}: {
  box: GalleryLayoutBox<CatgirlImage>;
  status: 'loaded' | 'error' | undefined;
  linkAttribution: boolean;
  loading: 'lazy' | 'eager';
  onLoad: () => void;
  onError: () => void;
}) {
  const { item: image } = box;

  return (
    <figure
      className="relative shrink-0 overflow-hidden rounded-2xl shadow-[0_8px_24px_-12px_rgba(157,23,77,0.35)] transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-14px_rgba(157,23,77,0.45)]"
      style={{ width: box.width, height: box.height }}
    >
      {/* Filled with the image's own dominant color (from Nekosia) while
          it loads, and left in place if it fails — a themed placeholder
          instead of a blank box or a broken-image glyph either way. */}
      <div className="absolute inset-0" style={{ backgroundColor: image.color }} aria-hidden />
      {status !== 'error' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image.url}
          alt="Catgirl"
          loading={loading}
          className={cn(
            'absolute inset-0 h-full w-full object-contain object-center transition-opacity duration-500',
            status === 'loaded' ? 'opacity-100' : 'opacity-0',
          )}
          onLoad={onLoad}
          onError={onError}
        />
      )}
      <CatgirlAttribution image={image} linkAttribution={linkAttribution} />
    </figure>
  );
}
