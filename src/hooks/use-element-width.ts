'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Tracks an element's rendered content-box width via `ResizeObserver` —
 * the actual space available, which can differ from what a CSS breakpoint
 * alone would suggest (a narrower parent, a sidebar, a split-screen
 * browser window). `null` until the first measurement lands, since there's
 * nothing to lay out against yet.
 */
export function useElementWidth<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  number | null,
] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof ResizeObserver === 'undefined') {
      setWidth(node.getBoundingClientRect().width);
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = entry.contentRect.width;
      // Skip sub-pixel noise: some browsers fire ResizeObserver for
      // fractional changes that would otherwise re-run the layout
      // algorithm every frame during a smooth window resize for no
      // visible benefit.
      setWidth((prev) => (prev !== null && Math.abs(prev - next) < 1 ? prev : next));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
