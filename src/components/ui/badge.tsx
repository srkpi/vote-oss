import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils/common';

const badgeVariants = cva(
  'font-body inline-flex items-center justify-center gap-1 rounded-full border border-transparent font-medium whitespace-nowrap transition-colors duration-150 select-none',
  {
    variants: {
      variant: {
        default: 'bg-border-color border-border-color text-foreground',
        secondary: 'border-border-subtle bg-surface text-muted-foreground',
        outline: 'border-border-color bg-transparent text-foreground',
        navy: 'border-kpi-navy bg-kpi-navy text-white',
        primary: 'border-kpi-navy bg-kpi-navy text-white',
        success: 'border-success/30 bg-success-bg text-success',
        warning: 'border-kpi-orange/30 bg-warning-bg text-kpi-orange',
        error: 'border-error/30 bg-error-bg text-error',
        destructive: 'border-error/30 bg-error-bg text-error',
        info: 'border-kpi-blue-light/30 bg-info-bg text-kpi-blue-light',
        accent: 'border-kpi-orange bg-kpi-orange text-white',
        ghost: 'border-transparent bg-transparent text-muted-foreground hover:bg-surface',
      },
      size: {
        sm: 'h-4 px-1.5 text-[10px]',
        md: 'h-5 px-2 text-xs',
        lg: 'h-6 px-2.5 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'navy'
  | 'primary'
  | 'success'
  | 'warning'
  | 'error'
  | 'destructive'
  | 'info'
  | 'accent'
  | 'ghost';

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-kpi-gray-mid',
  secondary: 'bg-kpi-gray-mid',
  outline: 'bg-kpi-gray-mid',
  navy: 'bg-white',
  primary: 'bg-white',
  success: 'bg-success',
  warning: 'bg-kpi-orange',
  error: 'bg-error',
  destructive: 'bg-error',
  info: 'bg-kpi-blue-light',
  accent: 'bg-white',
  ghost: 'bg-kpi-gray-mid',
};

export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  asChild?: boolean;
  dot?: boolean;
  muted?: boolean;
  variant?: BadgeVariant;
  size?: BadgeSize;
}

function Badge({
  className,
  variant = 'default',
  size = 'md',
  asChild = false,
  dot = false,
  muted = false,
  children,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), muted && 'opacity-50', className)}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            'inline-block shrink-0 rounded-full',
            size === 'sm' ? 'h-1 w-1' : 'h-1.5 w-1.5',
            dotColors[variant ?? 'default'],
          )}
        />
      )}
      {children}
    </Comp>
  );
}

export { Badge, badgeVariants };
