import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { Slot } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 font-medium font-body',
    'whitespace-nowrap rounded-[var(--radius)] border border-transparent',
    'transition-all duration-150 select-none cursor-pointer',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kpi-blue-light)] focus-visible:ring-offset-1',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'bg-[var(--kpi-navy)] text-white hover:bg-[var(--kpi-navy-hover)] shadow-[var(--shadow-button)]',
        primary:
          'bg-[var(--kpi-navy)] text-white hover:bg-[var(--kpi-navy-hover)] shadow-[var(--shadow-button)]',
        accent:
          'bg-[var(--kpi-orange)] text-white hover:bg-[var(--kpi-orange-dark)] shadow-[var(--shadow-button-accent)]',
        secondary:
          'bg-[var(--surface)] text-[var(--foreground)] border-[var(--border-color)] hover:bg-[var(--surface-hover)] hover:border-[var(--kpi-blue-light)]/40',
        ghost:
          'bg-transparent text-[var(--foreground)] hover:bg-[var(--surface)] border-transparent',
        outline:
          'bg-transparent text-[var(--foreground)] border-[var(--border-color)] hover:bg-[var(--surface)] hover:border-[var(--kpi-blue-light)]/50',
        danger:
          'bg-[var(--error-bg)] text-[var(--error)] border-[var(--error)]/20 hover:bg-[var(--error)] hover:text-white hover:border-[var(--error)]',
        destructive:
          'bg-[var(--error)] text-white hover:bg-[var(--error)]/90 shadow-[var(--shadow-sm)]',
        link: 'bg-transparent text-[var(--kpi-navy)] underline-offset-4 hover:underline border-transparent p-0 h-auto',
      },
      size: {
        xs: 'h-6 px-2 text-xs rounded-md gap-1 [&_svg]:w-3 [&_svg]:h-3',
        sm: 'h-8 px-3 text-sm rounded-[var(--radius)] gap-1.5 [&_svg]:w-3.5 [&_svg]:h-3.5',
        md: 'h-9 px-4 text-sm rounded-[var(--radius)] gap-2 [&_svg]:w-4 [&_svg]:h-4',
        default: 'h-9 px-4 text-sm rounded-[var(--radius)] gap-2 [&_svg]:w-4 [&_svg]:h-4',
        lg: 'h-10 px-5 text-sm rounded-[var(--radius-lg)] gap-2 [&_svg]:w-4 [&_svg]:h-4',
        xl: 'h-12 px-6 text-base rounded-[var(--radius-lg)] gap-2.5 [&_svg]:w-5 [&_svg]:h-5',
        icon: 'h-9 w-9 rounded-[var(--radius)] p-0 [&_svg]:w-4 [&_svg]:h-4',
        'icon-xs': 'h-6 w-6 rounded-md p-0 [&_svg]:w-3 [&_svg]:h-3',
        'icon-sm': 'h-8 w-8 rounded-[var(--radius)] p-0 [&_svg]:w-3.5 [&_svg]:h-3.5',
        'icon-lg': 'h-10 w-10 rounded-[var(--radius-lg)] p-0 [&_svg]:w-5 [&_svg]:h-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonVariant =
  | 'default'
  | 'primary'
  | 'accent'
  | 'secondary'
  | 'ghost'
  | 'outline'
  | 'danger'
  | 'destructive'
  | 'link';

export type ButtonSize =
  | 'xs'
  | 'sm'
  | 'md'
  | 'default'
  | 'lg'
  | 'xl'
  | 'icon'
  | 'icon-xs'
  | 'icon-sm'
  | 'icon-lg';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  const isDisabled = disabled || loading;
  const isIconOnly = size?.startsWith('icon') && !children;

  if (asChild) {
    return (
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size }), fullWidth && 'w-full', className)}
        {...props}
      >
        {children}
      </Comp>
    );
  }

  return (
    <button
      data-slot="button"
      disabled={isDisabled}
      className={cn(buttonVariants({ variant, size }), fullWidth && 'w-full', className)}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" />
          {!isIconOnly && children}
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && !isIconOnly && icon}
          {isIconOnly ? icon : children}
          {icon && iconPosition === 'right' && !isIconOnly && icon}
        </>
      )}
    </button>
  );
}

export { Button, buttonVariants };
