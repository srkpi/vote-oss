import { cn } from '@/lib/utils/common';
import type { CatgirlImage } from '@/types/catgirl';

interface CatgirlAttributionProps {
  image: CatgirlImage;
  className?: string;
}

export function CatgirlAttribution({ image, className }: CatgirlAttributionProps) {
  if (!image.artistName) return null;

  const href = image.artistProfileUrl ?? image.sourceUrl ?? undefined;

  return (
    <span
      className={cn(
        'text-muted-foreground bg-card/80 absolute right-2 bottom-2 z-10 rounded-full px-2 py-0.5 text-[10px] backdrop-blur-sm',
        className,
      )}
    >
      {href ? (
        <a
          href={href}
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
}
