'use client';

import { useCallback, useState } from 'react';

/**
 * Tracks an element's rendered content-box width via `ResizeObserver` —
 * the actual space available, which can differ from what a CSS breakpoint
 * alone would suggest (a narrower parent, a sidebar, a split-screen
 * browser window). `null` until the first measurement lands, since there's
 * nothing to lay out against yet.
 *
 * Returns a *callback* ref rather than a `useRef` object, on purpose: the
 * observer has to attach whenever the element actually appears, not just
 * once when the hook's host component first mounts. A component that
 * renders `null` on the server (and during hydration) and only mounts the
 * measured element afterwards — like `CatgirlGallery` when catgirl mode
 * turns out to be on — would otherwise run a mount-only effect while
 * `ref.current` is still `null`, never observe anything, and stay at
 * `null` forever. A callback ref is invoked at the moment the element is
 * attached (and its returned cleanup at the moment it's detached), so it
 * works the same whether the element is there from the first render or
 * shows up several renders later.
 */
export function useElementWidth<T extends HTMLElement>(): [React.RefCallback<T>, number | null] {
  const [width, setWidth] = useState<number | null>(null);

  const ref = useCallback((node: T | null) => {
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
