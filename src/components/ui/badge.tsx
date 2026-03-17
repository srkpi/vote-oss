import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center gap-1 font-medium font-body whitespace-nowrap rounded-full border border-transparent transition-colors duration-150 select-none',
  {
    variants: {
      variant: {
        default: 'bg-[var(--border-color)] text-[var(--foreground)] border-[var(--border-color)]',
        secondary:
          'bg-[var(--surface)] text-[var(--muted-foreground)] border-[var(--border-subtle)]',
        outline: 'bg-transparent text-[var(--foreground)] border-[var(--border-color)]',
        navy: 'bg-[var(--kpi-navy)] text-white border-[var(--kpi-navy)]',
        primary: 'bg-[var(--kpi-navy)] text-white border-[var(--kpi-navy)]',
        success: 'bg-[var(--success-bg)] text-[var(--success)] border-[var(--success)]/30',
        warning: 'bg-[var(--warning-bg)] text-[var(--kpi-orange)] border-[var(--kpi-orange)]/30',
        error: 'bg-[var(--error-bg)] text-[var(--error)] border-[var(--error)]/30',
        destructive: 'bg-[var(--error-bg)] text-[var(--error)] border-[var(--error)]/30',
        info: 'bg-[var(--info-bg)] text-[var(--kpi-blue-light)] border-[var(--kpi-blue-light)]/30',
        accent: 'bg-[var(--kpi-orange)] text-white border-[var(--kpi-orange)]',
        ghost:
          'bg-transparent text-[var(--muted-foreground)] border-transparent hover:bg-[var(--surface)]',
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
  default: 'bg-[var(--kpi-gray-mid)]',
  secondary: 'bg-[var(--kpi-gray-mid)]',
  outline: 'bg-[var(--kpi-gray-mid)]',
  navy: 'bg-white',
  primary: 'bg-white',
  success: 'bg-[var(--success)]',
  warning: 'bg-[var(--kpi-orange)]',
  error: 'bg-[var(--error)]',
  destructive: 'bg-[var(--error)]',
  info: 'bg-[var(--kpi-blue-light)]',
  accent: 'bg-white',
  ghost: 'bg-[var(--kpi-gray-mid)]',
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
            'inline-block rounded-full shrink-0',
            size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5',
            dotColors[variant ?? 'default'],
          )}
        />
      )}
      {children}
    </Comp>
  );
}

export { Badge, badgeVariants };
