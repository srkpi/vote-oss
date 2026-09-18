import { cn } from '@/lib/utils/common';
import type { CatgirlImage } from '@/types/catgirl';

interface CatgirlAttributionProps {
  image: CatgirlImage;
  /** Link the artist name to their profile/source page. Off for contexts
   *  that don't want a nested interactive element (e.g. the whole image
   *  already sits inside a link/button). */
  linkAttribution?: boolean;
  className?: string;
}

/**
 * The small "artist name" chip pinned to an image's own bottom-right
 * corner. Its own component (rather than inline markup in `CatgirlGallery`)
 * because a gallery renders several images at once, each needing exactly
 * the same chip — one shared definition instead of a copy per image.
 */
export function CatgirlAttribution({
  image,
  linkAttribution = true,
  className,
}: CatgirlAttributionProps) {
  if (!image.artistName) return null;

  const href = image.artistProfileUrl ?? image.sourceUrl ?? undefined;

  return (
    <span
      className={cn(
        'text-muted-foreground bg-card/80 absolute right-2 bottom-2 rounded-full px-2 py-0.5 text-[10px] backdrop-blur-sm',
        className,
      )}
    >
      {linkAttribution && href ? (
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
