'use client';

import { useEffect, useRef } from 'react';

export interface PointerState {
  x: number;
  y: number;
}

export type PointerRef = React.RefObject<PointerState>;

/**
 * Tracks pointer position, normalized to roughly [-1, 1] relative to the
 * given container's bounds (falling back to the full viewport), as a plain
 * ref rather than React state.
 *
 * This is intentionally independent of `@react-three/fiber`'s own
 * `state.pointer`: that only updates from events that land *on the canvas
 * element itself*, and the canvas here sits behind headline text and
 * buttons that capture the pointer first.
 *
 * The listener is always attached to `window`, not to `containerRef` — the
 * container is a decorative absolutely-positioned *sibling* of the text
 * overlay in the DOM (not its ancestor), so a listener on the container
 * alone would never see events that land on the text: pointer events only
 * bubble up an element's own ancestor chain. `window` is an ancestor of
 * everything, so this keeps tracking the cursor no matter which element in
 * the page it's currently over; `containerRef` is only used afterwards, to
 * express that position relative to this scene's own bounds.
 */
export function usePointerParallax(containerRef?: React.RefObject<HTMLElement | null>): PointerRef {
  const pointer = useRef<PointerState>({ x: 0, y: 0 });

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const rect =
        containerRef?.current?.getBoundingClientRect() ??
        ({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight } as DOMRect);

      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;

      pointer.current.x = THREE_clamp(x, -1.4, 1.4);
      pointer.current.y = THREE_clamp(y, -1.4, 1.4);
    };

    const handlePointerLeave = () => {
      pointer.current.x = 0;
      pointer.current.y = 0;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.documentElement.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [containerRef]);

  return pointer;
}

function THREE_clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
