import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center gap-1 font-medium font-body whitespace-nowrap rounded-full border border-transparent transition-colors duration-150 select-none',
  {
    variants: {
      variant: {
        default: 'bg-(--border-color) text-(--foreground) border-(--border-color)',
        secondary: 'bg-(--surface) text-(--muted-foreground) border-(--border-subtle)',
        outline: 'bg-transparent text-(--foreground) border-(--border-color)',
        navy: 'bg-(--kpi-navy) text-white border-(--kpi-navy)',
        primary: 'bg-(--kpi-navy) text-white border-(--kpi-navy)',
        success: 'bg-(--success-bg) text-(--success) border-(--success)/30',
        warning: 'bg-(--warning-bg) text-(--kpi-orange) border-(--kpi-orange)/30',
        error: 'bg-(--error-bg) text-(--error) border-(--error)/30',
        destructive: 'bg-(--error-bg) text-(--error) border-(--error)/30',
        info: 'bg-(--info-bg) text-(--kpi-blue-light) border-(--kpi-blue-light)/30',
        accent: 'bg-(--kpi-orange) text-white border-(--kpi-orange)',
        ghost: 'bg-transparent text-(--muted-foreground) border-transparent hover:bg-(--surface)',
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

const dotColors: Record<string, string> = {
  default: 'bg-(--kpi-gray-mid)',
  secondary: 'bg-(--kpi-gray-mid)',
  outline: 'bg-(--kpi-gray-mid)',
  navy: 'bg-white',
  primary: 'bg-white',
  success: 'bg-(--success)',
  warning: 'bg-(--kpi-orange)',
  error: 'bg-(--error)',
  destructive: 'bg-(--error)',
  info: 'bg-(--kpi-blue-light)',
  accent: 'bg-white',
  ghost: 'bg-(--kpi-gray-mid)',
};

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

export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  asChild?: boolean;
  dot?: boolean;
  variant?: BadgeVariant;
  size?: BadgeSize;
}

function Badge({
  className,
  variant = 'default',
  size = 'md',
  asChild = false,
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant, size }), className)} {...props}>
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
