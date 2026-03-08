'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// ==================== VARIANTS ====================

const alertVariants = cva(
  'relative flex w-full gap-3 rounded-[var(--radius-lg)] border p-4 text-sm font-body transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'bg-white border-[var(--border-color)] text-[var(--foreground)]',
        success:
          'bg-[var(--success-bg)] border-[var(--success)]/30 text-[var(--foreground)] [&_.alert-icon]:text-[var(--success)]',
        warning:
          'bg-[var(--warning-bg)] border-[var(--kpi-orange)]/30 text-[var(--foreground)] [&_.alert-icon]:text-[var(--kpi-orange)]',
        error:
          'bg-[var(--error-bg)] border-[var(--error)]/30 text-[var(--foreground)] [&_.alert-icon]:text-[var(--error)]',
        info: 'bg-[var(--info-bg)] border-[var(--kpi-blue-light)]/30 text-[var(--foreground)] [&_.alert-icon]:text-[var(--kpi-blue-light)]',
        destructive:
          'bg-[var(--error-bg)] border-[var(--error)]/30 text-[var(--foreground)] [&_.alert-icon]:text-[var(--error)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const ALERT_ICONS: Record<string, React.ReactNode> = {
  default: (
    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  success: (
    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  destructive: (
    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
};

// ==================== TYPES ====================

export type AlertVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'destructive';

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  title?: string;
  onDismiss?: () => void;
  showIcon?: boolean;
  variant?: AlertVariant;
}

// ==================== ALERT ====================

export function Alert({
  className,
  variant = 'default',
  title,
  onDismiss,
  showIcon = true,
  children,
  ...props
}: AlertProps) {
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      {showIcon && <span className="alert-icon">{ALERT_ICONS[variant ?? 'default']}</span>}
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold text-sm leading-tight mb-0.5 font-body">{title}</p>}
        {children && (
          <div className="text-sm text-[var(--foreground)]/80 font-body leading-relaxed">
            {children}
          </div>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className={cn(
            'shrink-0 self-start p-0.5 rounded-md',
            'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
            'hover:bg-black/5 transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kpi-blue-light)]',
          )}
          aria-label="Закрити"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

// ==================== ALERT SUB-COMPONENTS ====================

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('font-semibold text-sm leading-tight mb-0.5 font-body', className)}
      {...props}
    />
  );
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('text-sm text-[var(--foreground)]/80 font-body leading-relaxed', className)}
      {...props}
    />
  );
}

// ==================== TOAST ITEM ====================

export type ToastVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

export interface ToastItemProps {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  onDismiss: (id: string) => void;
}

const toastAccentColors: Record<ToastVariant, string> = {
  default: 'bg-[var(--kpi-navy)]',
  success: 'bg-[var(--success)]',
  warning: 'bg-[var(--kpi-orange)]',
  error: 'bg-[var(--error)]',
  info: 'bg-[var(--kpi-blue-light)]',
};

const toastIconColors: Record<ToastVariant, string> = {
  default: 'text-[var(--kpi-navy)]',
  success: 'text-[var(--success)]',
  warning: 'text-[var(--kpi-orange)]',
  error: 'text-[var(--error)]',
  info: 'text-[var(--kpi-blue-light)]',
};

const TOAST_ICONS: Record<ToastVariant, React.ReactNode> = {
  default: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  success: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
};

export function ToastItem({
  id,
  title,
  description,
  variant = 'default',
  onDismiss,
}: ToastItemProps) {
  return (
    <div
      className={cn(
        'relative flex items-start gap-3',
        'w-80 overflow-hidden',
        'bg-white rounded-[var(--radius-xl)]',
        'border border-[var(--border-color)]',
        'shadow-[var(--shadow-xl)]',
        'p-4',
        'animate-slide-right',
      )}
      role="alert"
    >
      {/* Left accent bar */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1 rounded-l-[var(--radius-xl)]',
          toastAccentColors[variant],
        )}
      />

      {/* Icon */}
      <div className={cn('shrink-0 mt-0.5', toastIconColors[variant])}>{TOAST_ICONS[variant]}</div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-1">
        <p className="font-semibold text-sm text-[var(--foreground)] font-body leading-tight">
          {title}
        </p>
        {description && (
          <p className="text-xs text-[var(--muted-foreground)] font-body mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={() => onDismiss(id)}
        className={cn(
          'shrink-0 p-0.5 rounded-md self-start',
          'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
          'hover:bg-[var(--surface)] transition-colors duration-150',
        )}
        aria-label="Закрити"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
