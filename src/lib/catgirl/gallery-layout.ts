/**
 * "Justified gallery" packing — the same family of algorithm behind photo
 * grids like Google Photos or Flickr's classic layout, adapted for a small
 * (1–5 image), self-contained widget — and, with `trailingRow: 'hold'`, for
 * the ever-growing feed on /catgirl (see `use-catgirl-feed.ts`).
 *
 * The problem this solves: Nekosia images come back in all sorts of aspect
 * ratios, but mostly tall/vertical ones (per the `catgirl` category). A
 * single vertical image alone in a wide desktop container looks lost — a
 * narrow strip surrounded by empty space. The fix isn't a fixed grid (a
 * uniform N×N grid either crops every image to fit its cell or leaves the
 * same empty space, just chopped into more pieces) — it's to let images
 * keep their own aspect ratio and pack *several* onto one row, scaled to a
 * shared row height, until that row's combined width fills the container.
 * Narrow (vertical) images naturally cluster several-to-a-row this way
 * (each contributes little width at a given height); wide (horizontal)
 * images naturally end up one, maybe two, to a row. No orientation-specific
 * branching is needed — it falls out of the same width-accumulation loop
 * either way, and it degrades gracefully to "one image, full width" on a
 * mobile-width container without any separate mobile/desktop code path.
 *
 * Algorithm, per row: add images left-to-right, tracking the sum of their
 * (clamped) aspect ratios. After each addition, check what row height that
 * sum implies at the container's exact width — once that's at or below
 * `targetHeight`, the row has accumulated enough width and is closed out.
 * Closing a row "justifies" it: the row's actual height is that implied
 * height, clamped to `[minHeight, maxHeight]`, and every image's width is
 * `clampedAspectRatio * rowHeight` — so the row's total width lands on
 * (or, if the clamp bit, near) the container width exactly. The very last
 * row (wherever the image list or the `maxImages`/`maxRows` budget runs
 * out) is justified the same way as any other, rather than left ragged at
 * `targetHeight` — with only 1–5 images and a caller that keeps a healthy
 * buffer claimed ahead of time (see `use-catgirl-gallery.ts`), "ragged
 * last row" isn't really a real state here the way it is for an
 * infinite-scroll wall, and always justifying means the widget never ends
 * on an awkward gap. A wall that keeps growing is the exception: there the
 * last row genuinely is unfinished, so `trailingRow: 'hold'` leaves it out
 * until later items complete it.
 */

/** Anything with a known intrinsic size can be laid out — doesn't have to
 *  be an image specifically, just needs a real `width`/`height` in the
 *  same unit (Nekosia gives pixel dimensions, which is what's used here). */
export interface GalleryLayoutSource {
  width: number;
  height: number;
}

export interface GalleryLayoutBox<T extends GalleryLayoutSource> {
  item: T;
  /** Display size in px, already clamped to fit within the row/container —
   *  safe to use directly as inline `width`/`height` styles. */
  width: number;
  height: number;
}

export interface GalleryLayoutRow<T extends GalleryLayoutSource> {
  boxes: GalleryLayoutBox<T>[];
  /** Shared height of every box in this row, in px. */
  height: number;
  /** Total width the row's boxes + the gaps between them occupy. Equal to
   *  `containerWidth` unless `minHeight`/`maxHeight` clamped this row away
   *  from its natural fit — in that case it's the caller's job to center
   *  the row (e.g. `justify-content: center`) rather than stretch it,
   *  since stretching would mean cropping or distorting an image. */
  width: number;
}

export interface GalleryLayoutOptions {
  /** Ideal row height to aim for before the min/max clamp below and the
   *  final-fit safety net (see the module doc comment) adjust it. */
  targetHeight: number;
  /** A row's height is never justified outside this range... */
  minHeight: number;
  maxHeight: number;
  /** ...except that stated range comes second to never overflowing the
   *  container: if even `minHeight` would make a row wider than
   *  `containerWidth` (only realistically possible for a single very wide
   *  image alone in a narrow container), the row is shrunk further still.
   *  See `finalizeRow` below. */
  gap: number;
  /** Stop once this many images have been placed, even if more were
   *  passed in and there's technically still room. */
  maxImages: number;
  /** Stop adding rows once this many exist, even if images/room remain. */
  maxRows: number;
  /** Never put more than this many images in one row. Mostly matters for
   *  very narrow (tall) images, which can otherwise keep fitting well past
   *  what looks like a comfortable row — see the module doc comment. */
  maxPerRow: number;
  /** What happens to the trailing row — the one that's still short of a
   *  full row's worth of width when the items run out. `'justify'` (the
   *  default) stretches it like any other row: right for a fixed-size
   *  widget that never grows. `'hold'` leaves it out of the result until
   *  more items complete it: right for a feed that keeps appending, where
   *  justifying a half-built row would resize its images on every batch.
   *  With `'hold'`, every row returned is final — appending items never
   *  changes a row that was already returned. */
  trailingRow?: 'justify' | 'hold';
}

/**
 * Real-world fan art runs from tall phone-wallpaper crops to wide desktop
 * ones; clamping the aspect ratio used for layout math (never the image's
 * own rendering — `object-fit` isn't involved, the box is simply sized to
 * this ratio) keeps one pathological outlier (a near-square icon, a 3:1
 * banner) from producing a degenerate row height. The values sit outside
 * the range typical "catgirl" fan art actually falls in — roughly 0.6–0.85
 * for vertical pieces, 1.2–1.8 for horizontal ones — so ordinary images
 * are never affected by the clamp, only genuine outliers.
 */
const MIN_ASPECT_RATIO = 0.45;
const MAX_ASPECT_RATIO = 2.2;

function clampedAspectRatio(item: GalleryLayoutSource): number {
  if (!(item.width > 0) || !(item.height > 0)) return 1;
  const raw = item.width / item.height;
  return Math.min(MAX_ASPECT_RATIO, Math.max(MIN_ASPECT_RATIO, raw));
}

/**
 * Packs `items` (in the order given — see the module doc comment on why
 * that's enough, no reordering/grouping by orientation needed) into rows
 * that fill `containerWidth`. Pure and framework-free: `use-catgirl-gallery
 * .ts` is what turns this into actual React state, tied to a measured
 * container and a claimed set of images.
 */
export function computeJustifiedGalleryLayout<T extends GalleryLayoutSource>(
  items: readonly T[],
  containerWidth: number,
  options: GalleryLayoutOptions,
): GalleryLayoutRow<T>[] {
  const { targetHeight, minHeight, maxHeight, gap, maxImages, maxRows, maxPerRow } = options;
  const trailingRow = options.trailingRow ?? 'justify';
  if (containerWidth <= 0 || maxImages <= 0 || maxRows <= 0 || maxPerRow <= 0) return [];

  const rows: GalleryLayoutRow<T>[] = [];
  let rowItems: T[] = [];
  let rowAspectSum = 0;

  const finalizeRow = (): void => {
    if (rowItems.length === 0) return;
    const gapsWidth = gap * (rowItems.length - 1);
    const availableWidth = Math.max(containerWidth - gapsWidth, 1);
    const idealHeight = availableWidth / rowAspectSum;
    let rowHeight = Math.min(maxHeight, Math.max(minHeight, idealHeight));

    let widths = rowItems.map((item) => clampedAspectRatio(item) * rowHeight);
    let totalWidth = widths.reduce((sum, w) => sum + w, 0);

    // Safety net (see `gap`'s doc comment above): the min/max clamp is
    // about taste, this is about correctness. However rare, a row is
    // never handed back wider than the container it was asked to fit.
    if (totalWidth + gapsWidth > containerWidth) {
      const scale = availableWidth / totalWidth;
      rowHeight *= scale;
      widths = widths.map((w) => w * scale);
      totalWidth = widths.reduce((sum, w) => sum + w, 0);
    }

    rows.push({
      height: rowHeight,
      width: totalWidth + gapsWidth,
      boxes: rowItems.map((item, i) => ({ item, width: widths[i], height: rowHeight })),
    });
    rowItems = [];
    rowAspectSum = 0;
  };

  let placed = 0;
  for (const item of items) {
    if (placed >= maxImages || rows.length >= maxRows) break;

    const aspect = clampedAspectRatio(item);

    if (rowItems.length > 0) {
      const gapsIfAdded = gap * rowItems.length;
      const heightIfAdded = Math.max(containerWidth - gapsIfAdded, 1) / (rowAspectSum + aspect);
      // Adding this image would either overshoot the row-count cap or
      // require justifying below `minHeight` to fit — either way, close
      // the current row out first and let this image start the next one,
      // rather than cramming it in and relying on the safety net above
      // (which would make *every* image in the row thinner than intended,
      // not just the one that didn't really belong).
      if (rowItems.length >= maxPerRow || heightIfAdded < minHeight) {
        finalizeRow();
        if (rows.length >= maxRows) break;
      }
    }

    rowItems.push(item);
    rowAspectSum += aspect;
    placed += 1;

    const gapsWidth = gap * (rowItems.length - 1);
    const naturalHeight = Math.max(containerWidth - gapsWidth, 1) / rowAspectSum;
    if (naturalHeight <= targetHeight) {
      finalizeRow();
      if (rows.length >= maxRows) break;
    }
  }

  if (trailingRow === 'justify' && rows.length < maxRows) finalizeRow();

  return rows;
}
