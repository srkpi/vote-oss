'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { useState } from 'react';

import { useCatgirlImage } from '@/hooks/use-catgirl-image';
import { cn } from '@/lib/utils/common';

const frameVariants = cva('relative flex items-center justify-center overflow-hidden rounded-xl', {
  variants: {
    size: {
      sm: 'h-36 sm:h-40',
      md: 'h-56 sm:h-64',
      lg: 'h-80 sm:h-96',
    },
  },
  defaultVariants: { size: 'sm' },
});

interface CatgirlInlineImageProps extends VariantProps<typeof frameVariants> {
  className?: string;
  linkAttribution?: boolean;
}

export function CatgirlInlineImage({
  className,
  size,
  linkAttribution = true,
}: CatgirlInlineImageProps) {
  const image = useCatgirlImage();
  const [failed, setFailed] = useState(false);

  if (!image || failed) return null;

  const credit = image.artistName && (
    <span className="text-muted-foreground bg-card/80 absolute right-2 bottom-2 rounded-full px-2 py-0.5 text-[10px] backdrop-blur-sm">
      {linkAttribution && (image.artistProfileUrl || image.sourceUrl) ? (
        <a
          href={image.artistProfileUrl ?? image.sourceUrl ?? undefined}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="hover:text-kpi-blue-light hover:underline"
        >
          {image.artistName}
        </a>
      ) : (
        <>{image.artistName}</>
      )}
    </span>
  );

  return (
    <figure className={cn(frameVariants({ size }), className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt="Catgirl"
        loading="lazy"
        className="relative max-h-full max-w-full rounded-lg object-contain shadow-sm"
        onError={() => setFailed(true)}
      />
      {credit}
    </figure>
  );
}
