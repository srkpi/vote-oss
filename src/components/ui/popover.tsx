'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils/common';

interface PopoverPosition {
  top?: number;
  bottom?: number;
  left: number;
  upward: boolean;
  maxHeight: number;
}

function computePosition(anchor: HTMLElement, width: number, height: number): PopoverPosition {
  const rect = anchor.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const margin = 8;

  const spaceBelow = viewportHeight - rect.bottom;
  const spaceAbove = rect.top;

  let upward = false;
  // If it doesn't fit below AND there is more space above than below, flip it upward
  if (spaceBelow < height + margin && spaceAbove > spaceBelow) {
    upward = true;
  }

  let left = rect.left;
  if (left + width > viewportWidth - margin) {
    left = Math.max(margin, viewportWidth - width - margin);
  }

  // Calculate the maximum height so it never runs off-screen
  const maxHeight = (upward ? spaceAbove : spaceBelow) - margin;

  if (upward) {
    // Use bottom positioning instead of transform. This prevents CSS animations
    // (like animate-scale-in) from overriding the upward positioning.
    return { bottom: viewportHeight - rect.top, left, upward, maxHeight };
  }

  return { top: rect.bottom, left, upward, maxHeight };
}

export interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  width?: number;
  className?: string;
  children: React.ReactNode;
}

/**
 * Generic anchored popover: portal-rendered, viewport-aware (flips upward
 * near the bottom edge, clamps horizontally so it never runs off-screen),
 * closes on outside pointerdown or Escape.
 */
export function Popover({
  open,
  onOpenChange,
  anchorRef,
  width = 288,
  className,
  children,
}: PopoverProps) {
  const popoverRef = React.useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = React.useState<PopoverPosition | null>(null);

  const recompute = React.useCallback(() => {
    if (!anchorRef.current) return;

    // Use scrollHeight to get the true unconstrained content height
    const height = popoverRef.current?.scrollHeight || 260;

    setPosition((prev) => {
      const next = computePosition(anchorRef.current!, width, height);
      // Bail out if state hasn't changed to prevent ResizeObserver loops
      if (
        prev?.top === next.top &&
        prev?.bottom === next.bottom &&
        prev?.left === next.left &&
        prev?.upward === next.upward &&
        prev?.maxHeight === next.maxHeight
      ) {
        return prev;
      }
      return next;
    });
  }, [anchorRef, width]);

  React.useLayoutEffect(() => {
    if (open) recompute();
  }, [open, recompute]);

  React.useEffect(() => {
    if (!open) return undefined;

    const handleOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };

    document.addEventListener('pointerdown', handleOutside);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);

    // Watch for internal dynamic content changes (like async fetched lists expanding)
    const observer = new ResizeObserver(() => recompute());
    if (popoverRef.current) {
      observer.observe(popoverRef.current);
    }

    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
      observer.disconnect();
    };
  }, [open, onOpenChange, recompute, anchorRef]);

  if (!open || typeof document === 'undefined') return null;

  // Dynamically apply top vs bottom so they never conflict
  const style: React.CSSProperties = {
    position: 'fixed',
    left: position?.left ?? -9999,
    width,
    maxHeight: position?.maxHeight,
  };

  if (position) {
    if (position.upward) {
      style.bottom = position.bottom;
    } else {
      style.top = position.top;
    }
  } else {
    style.top = -9999;
  }

  return createPortal(
    <div
      ref={popoverRef}
      style={style}
      className={cn(
        'z-50 rounded-lg',
        'overflow-x-hidden overflow-y-auto', // Ensure scrolling happens
        'border-border-color border bg-white',
        'shadow-lg',
        'animate-scale-in',
        className,
      )}
      role="dialog"
    >
      {children}
    </div>,
    document.body,
  );
}
