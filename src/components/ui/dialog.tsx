'use client';

import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils/common';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Dialog({ open, onClose, children }: DialogProps) {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="animate-fade-in absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="animate-scale-in relative z-10 w-full">{children}</div>
    </div>
  );
}

interface DialogPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const maxWidths = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

export function DialogPanel({ className, maxWidth = 'md', children, ...props }: DialogPanelProps) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full flex-col',
        maxWidths[maxWidth],
        'max-h-[calc(100dvh-2rem)]',
        'rounded-xl bg-white',
        'shadow-shadow-xl',
        'overflow-hidden',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DialogHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex shrink-0 items-start justify-between gap-4', 'p-6 pb-0', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function DialogTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn('font-display text-foreground text-2xl font-semibold', className)} {...props}>
      {children}
    </h2>
  );
}

export function DialogDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-muted-foreground mt-1 text-sm', className)} {...props}>
      {children}
    </p>
  );
}

export function DialogBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto p-6', className)} {...props}>
      {children}
    </div>
  );
}

export function DialogFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col-reverse gap-3 sm:flex-row sm:justify-end',
        'p-6 pt-0',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface DialogCloseButtonProps {
  onClose: () => void;
}

export function DialogCloseButton({ onClose }: DialogCloseButtonProps) {
  return (
    <button
      onClick={onClose}
      className={cn(
        'mt-0.5 shrink-0 rounded-sm p-1.5',
        'text-muted-foreground',
        'hover:bg-surface hover:text-foreground',
        'transition-colors duration-150',
        'focus-visible:ring-kpi-blue-light focus-visible:ring-2 focus-visible:outline-none',
      )}
      aria-label="Закрити"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
