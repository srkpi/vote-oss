'use client';

import { User } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils/common';

export type AvatarShape = 'circle' | 'rounded' | 'square';

interface AvatarProps {
  src?: string | null;
  /** Used to derive the fallback initial and the image alt text. */
  name?: string | null;
  icon?: boolean;
  /** Pixel size (both width and height — avatars are always square). */
  size?: number;
  shape?: AvatarShape;
  className?: string;
}

const SHAPE_CLASSES: Record<AvatarShape, string> = {
  circle: 'rounded-full',
  rounded: 'rounded-lg',
  square: 'rounded-none',
};

function initialFrom(name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '';
}

export function Avatar({
  src,
  name,
  icon = false,
  size = 40,
  shape = 'circle',
  className,
}: AvatarProps) {
  const [failed, setFailed] = useState(false);

  // Reset on src change so switching to a freshly-uploaded URL (or back to
  // "no avatar") doesn't stay stuck showing the previous fallback state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setFailed(false), [src]);

  const showImage = !!src && !failed;

  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden select-none',
        !icon && 'bg-kpi-navy text-white',
        SHAPE_CLASSES[shape],
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.42)) }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- pre-sized, same-origin uploaded content; see comment above
        <img
          src={src}
          alt={name ?? 'Avatar'}
          className="h-full w-full object-cover"
          draggable={false}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : icon ? (
        <User style={{ width: size, height: size }} />
      ) : (
        <span
          className={cn(
            'relative leading-none font-semibold',
            size > 32 ? 'top-px' : size <= 16 ? '' : 'top-[-0.5px]',
          )}
        >
          {initialFrom(name)}
        </span>
      )}
    </div>
  );
}
