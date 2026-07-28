'use client';

import type { ReactNode } from 'react';
import { useId, useRef, useState } from 'react';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
}

/**
 * Minimal hover/focus/tap tooltip. Unlike a native `title` attribute, this
 * works on touch devices (tap toggles it) and can be styled to match the
 * app instead of the browser's OS-native tooltip box.
 */
export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 80);
  };

  return (
    <span
      className={`relative inline-flex ${className ?? ''}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="inline-flex cursor-default items-center bg-transparent p-0"
      >
        {children}
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className={`border-border-color text-foreground pointer-events-none absolute z-20 w-max max-w-60 rounded-md border bg-white px-2.5 py-1.5 text-xs whitespace-normal shadow-lg ${
            side === 'top'
              ? 'bottom-full left-1/2 mb-1.5 -translate-x-1/2'
              : 'top-full left-1/2 mt-1.5 -translate-x-1/2'
          }`}
        >
          {content}
        </span>
      )}
    </span>
  );
}
