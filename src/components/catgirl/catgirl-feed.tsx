'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { CatgirlGalleryImage } from '@/components/catgirl/catgirl-gallery';
import { Button } from '@/components/ui/button';
import { useCatgirlFeed } from '@/hooks/use-catgirl-feed';
import { CATGIRL_GALLERY_GAP, CATGIRL_GALLERY_SIZE_PRESETS } from '@/lib/constants';

export function CatgirlFeed() {
  const { containerRef, sentinelRef, rows, stalled, retry } = useCatgirlFeed();
  const [imageStatus, setImageStatus] = useState<Record<string, 'loaded' | 'error'>>({});

  return (
    <div ref={containerRef} className="w-full">
      {rows.length === 0 ? (
        <div
          className="bg-surface-hover w-full animate-pulse rounded-2xl"
          style={{ height: CATGIRL_GALLERY_SIZE_PRESETS.lg.targetHeight }}
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
                  loading="lazy"
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

      <div ref={sentinelRef} className="flex h-20 items-center justify-center">
        {stalled ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="font-body text-kpi-navy text-sm">
              Не вдалося завантажити нові зображення
            </p>
            <Button variant="secondary" size="sm" onClick={retry}>
              Спробувати ще раз
            </Button>
          </div>
        ) : (
          <>
            <Loader2 className="text-kpi-navy h-6 w-6 animate-spin" aria-hidden="true" />
            <span className="sr-only" role="status">
              Завантаження…
            </span>
          </>
        )}
      </div>
    </div>
  );
}
