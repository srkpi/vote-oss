'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils/common';
import type { CatgirlImage } from '@/types/catgirl';

interface CatgirlLightboxProps {
  image: CatgirlImage;
  onClose: () => void;
}

export function CatgirlLightbox({ image, onClose }: CatgirlLightboxProps) {
  const [source, setSource] = useState<'original' | 'compressed'>('original');
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  const src = source === 'original' ? image.originalUrl : image.url;
  const attributionHref = image.artistProfileUrl ?? image.sourceUrl ?? null;

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Перегляд зображення на весь екран"
    >
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        className={cn(
          'absolute top-4 right-4 z-10 cursor-pointer rounded-full bg-black/40 p-2 text-white/90',
          'hover:bg-black/60 hover:text-white',
          'transition-colors duration-150',
          'focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:outline-none',
        )}
        aria-label="Закрити"
      >
        <X className="h-5 w-5" />
      </button>

      <figure className="animate-scale-in relative z-0 flex max-h-full max-w-full flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={image.artistName ? `Ілюстрація від ${image.artistName}` : 'Catgirl'}
          className="max-h-[85dvh] max-w-full rounded-lg object-contain shadow-2xl"
          style={{
            aspectRatio: `${image.originalWidth} / ${image.originalHeight}`,
            backgroundColor: image.color,
          }}
          onError={() => setSource((current) => (current === 'original' ? 'compressed' : current))}
        />
        {image.artistName && (
          <figcaption className="font-body text-sm text-white/80">
            {attributionHref ? (
              <a
                href={attributionHref}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="hover:text-white hover:underline"
              >
                {image.artistName}
              </a>
            ) : (
              image.artistName
            )}
          </figcaption>
        )}
      </figure>
    </div>,
    document.body,
  );
}
