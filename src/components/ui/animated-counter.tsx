'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  target: number;
  delay?: number;
  duration?: number;
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - 2 ** (-10 * t);
}

export function AnimatedCounter({ target, delay = 0, duration = 2000 }: AnimatedCounterProps) {
  const [value, setValue] = useState(0);
  const containerRef = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    if (target === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(0);
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || hasAnimated.current) return;
        hasAnimated.current = true;

        if (prefersReducedMotion) {
          setValue(target);
          return;
        }

        timeoutRef.current = setTimeout(() => {
          const startTime = performance.now();

          const tick = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            setValue(Math.round(easeOutExpo(progress) * target));

            if (progress < 1) {
              rafRef.current = requestAnimationFrame(tick);
            }
          };

          rafRef.current = requestAnimationFrame(tick);
        }, delay);
      },
      { threshold: 0.25 },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, delay, duration]);

  return (
    <span ref={containerRef} aria-label={target.toLocaleString('uk-UA')}>
      {value.toLocaleString('uk-UA')}
    </span>
  );
}
