import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { Slot } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 font-medium font-body',
    'whitespace-nowrap rounded-(--radius) border border-transparent',
    'transition-all duration-150 select-none cursor-pointer',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kpi-blue-light focus-visible:ring-offset-1',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-kpi-navy text-white hover:bg-kpi-navy-hover shadow-shadow-button',
        primary: 'bg-kpi-navy text-white hover:bg-kpi-navy-hover shadow-shadow-button',
        accent: 'bg-kpi-orange text-white hover:bg-kpi-orange-dark shadow-shadow-button-accent',
        secondary:
          'bg-surface text-foreground border-border-color hover:bg-surface-hover hover:border-kpi-blue-light/40',
        ghost: 'bg-transparent text-foreground hover:bg-surface border-transparent',
        outline:
          'bg-transparent text-foreground border-border-color hover:bg-surface hover:border-kpi-blue-light/50',
        danger:
          'bg-error-bg text-error border-error/20 hover:bg-error hover:text-white hover:border-error',
        destructive: 'bg-error text-white hover:bg-error/90 shadow-shadow-sm',
        link: 'bg-transparent text-kpi-navy underline-offset-4 hover:underline border-transparent p-0 h-auto',
      },
      size: {
        xs: 'h-6 px-2 text-xs rounded-md gap-1 [&_svg]:w-3 [&_svg]:h-3',
        sm: 'h-8 px-3 text-sm rounded-(--radius) gap-1.5 [&_svg]:w-3.5 [&_svg]:h-3.5',
        md: 'h-9 px-4 text-sm rounded-(--radius) gap-2 [&_svg]:w-4 [&_svg]:h-4',
        default: 'h-9 px-4 text-sm rounded-(--radius) gap-2 [&_svg]:w-4 [&_svg]:h-4',
        lg: 'h-10 px-5 text-sm rounded-lg gap-2 [&_svg]:w-4 [&_svg]:h-4',
        xl: 'h-12 px-6 text-base rounded-lg gap-2.5 [&_svg]:w-5 [&_svg]:h-5',
        icon: 'h-9 w-9 rounded-(--radius) p-0 [&_svg]:w-4 [&_svg]:h-4',
        'icon-xs': 'h-6 w-6 rounded-md p-0 [&_svg]:w-3 [&_svg]:h-3',
        'icon-sm': 'h-8 w-8 rounded-(--radius) p-0 [&_svg]:w-3.5 [&_svg]:h-3.5',
        'icon-lg': 'h-10 w-10 rounded-lg p-0 [&_svg]:w-5 [&_svg]:h-5',
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
