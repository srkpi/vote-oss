'use client';

import { useEffect, useRef, useState } from 'react';

interface UseLazyInViewOptions {
  /** Start mounting this far before the element actually enters the viewport. */
  rootMargin?: string;
  /** Skip the observer and report "in view" immediately (e.g. above-the-fold content). */
  eager?: boolean;
}

/**
 * Reports once an element has come near the viewport, and keeps reporting
 * `true` from then on (deliberately does not un-mount on scroll-away — that
 * would tear down and rebuild the WebGL context repeatedly, which is far
 * more expensive than just leaving a small idle scene mounted).
 */
export function useLazyInView<T extends HTMLElement>(
  options: UseLazyInViewOptions = {},
): [React.RefObject<T | null>, boolean] {
  const { rootMargin = '200px', eager = false } = options;
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(eager);

  useEffect(() => {
    if (eager || inView) return;
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [eager, inView, rootMargin]);

  return [ref, inView];
}
