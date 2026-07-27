'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils/common';

interface PopoverPosition {
  top: number;
  left: number;
  upward: boolean;
}

function computePosition(anchor: HTMLElement, width: number, height: number): PopoverPosition {
  const rect = anchor.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const margin = 8;

  const spaceBelow = viewportHeight - rect.bottom;
  const upward = spaceBelow < height + margin && rect.top > height + margin;

  let left = rect.left;
  if (left + width > viewportWidth - margin) {
    left = Math.max(margin, viewportWidth - width - margin);
  }

  return { top: upward ? rect.top : rect.bottom, left, upward };
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
 * closes on outside pointerdown or Escape. Generalized from the
 * positioning logic already used by KyivDateTimePicker so other anchored
 * popups (e.g. the comment "who voted" list) don't reimplement it.
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
    setPosition(computePosition(anchorRef.current, width, popoverRef.current?.offsetHeight || 260));
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

    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [open, onOpenChange, recompute, anchorRef]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        width,
        transform: position?.upward ? 'translateY(-100%)' : undefined,
      }}
      className={cn(
        'z-50 overflow-hidden rounded-lg',
        'border-border-color border bg-white',
        'shadow-shadow-lg',
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
