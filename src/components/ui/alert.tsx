'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils/common';

const alertVariants = cva(
  'relative flex w-full gap-3 rounded-lg border p-4 text-sm font-body transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'bg-white border-border-color text-foreground',
        success: 'bg-success-bg border-success/30 text-foreground [&_.alert-icon]:text-success',
        warning:
          'bg-warning-bg border-kpi-orange/30 text-foreground [&_.alert-icon]:text-kpi-orange',
        error: 'bg-error-bg border-error/30 text-foreground [&_.alert-icon]:text-error',
        info: 'bg-info-bg border-kpi-blue-light/30 text-foreground [&_.alert-icon]:text-kpi-blue-light',
        destructive: 'bg-error-bg border-error/30 text-foreground [&_.alert-icon]:text-error',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const ALERT_ICONS: Record<string, React.ReactNode> = {
  default: <Info className="mt-0.5 h-4 w-4 shrink-0" />,
  success: <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />,
  warning: <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />,
  error: <XCircle className="mt-0.5 h-4 w-4 shrink-0" />,
  info: <Info className="mt-0.5 h-4 w-4 shrink-0" />,
  destructive: <XCircle className="mt-0.5 h-4 w-4 shrink-0" />,
};

export type AlertVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'destructive';

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  title?: string;
  onDismiss?: () => void;
  showIcon?: boolean;
  variant?: AlertVariant;
}

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
      <div className="min-w-0 flex-1">
        {title && <p className="font-body mb-0.5 text-sm leading-tight font-semibold">{title}</p>}
        {children && (
          <div className="font-body text-foreground/80 text-sm leading-relaxed">{children}</div>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className={cn(
            'shrink-0 self-start rounded-md p-0.5',
            'text-muted-foreground hover:text-foreground',
            'transition-colors duration-150 hover:bg-black/5',
            'focus-visible:ring-kpi-blue-light focus-visible:ring-2 focus-visible:outline-none',
          )}
          aria-label="Закрити"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('font-body mb-0.5 text-sm leading-tight font-semibold', className)}
      {...props}
    />
  );
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('font-body text-foreground/80 text-sm leading-relaxed', className)}
      {...props}
    />
  );
}

export type ToastVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

export interface ToastItemProps {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  onDismiss: (id: string) => void;
}

const toastAccentColors: Record<ToastVariant, string> = {
  default: 'bg-kpi-navy',
  success: 'bg-success',
  warning: 'bg-kpi-orange',
  error: 'bg-error',
  info: 'bg-kpi-blue-light',
};

const toastIconColors: Record<ToastVariant, string> = {
  default: 'text-kpi-navy',
  success: 'text-success',
  warning: 'text-kpi-orange',
  error: 'text-error',
  info: 'text-kpi-blue-light',
};

const TOAST_ICONS: Record<ToastVariant, React.ReactNode> = {
  default: <Info className="h-4 w-4" />,
  success: <CheckCircle className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  error: <XCircle className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
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
        'rounded-xl bg-white',
        'border-border-color border',
        'shadow-shadow-xl',
        'p-4',
        'animate-slide-right',
      )}
      role="alert"
    >
      <div
        className={cn(
          'absolute top-0 bottom-0 left-0 w-1 rounded-l-xl',
          toastAccentColors[variant],
        )}
      />

      <div className={cn('mt-0.5 shrink-0', toastIconColors[variant])}>{TOAST_ICONS[variant]}</div>

      <div className="min-w-0 flex-1 pr-1">
        <p className="font-body text-foreground text-sm leading-tight font-semibold">{title}</p>
        {description && (
          <p className="font-body text-muted-foreground mt-0.5 text-xs leading-relaxed">
            {description}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(id)}
        className={cn(
          'shrink-0 self-start rounded-md p-0.5',
          'text-muted-foreground hover:text-foreground',
          'hover:bg-surface transition-colors duration-150',
        )}
        aria-label="Закрити"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
