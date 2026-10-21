import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { Slot } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils/common';

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
        default: 'bg-kpi-navy text-white shadow-button hover:bg-kpi-navy-hover',
        primary: 'bg-kpi-navy text-white shadow-button hover:bg-kpi-navy-hover',
        accent: 'bg-kpi-orange text-white shadow-button-accent hover:bg-kpi-orange-dark',
        secondary:
          'border-border-color bg-surface text-foreground hover:border-kpi-blue-light/40 hover:bg-surface-hover',
        ghost: 'border-transparent bg-transparent text-foreground hover:bg-surface',
        outline:
          'border-border-color bg-transparent text-foreground hover:border-kpi-blue-light/50 hover:bg-surface',
        danger:
          'border-error/20 bg-error-bg text-error hover:border-error hover:bg-error hover:text-white',
        destructive: 'bg-error text-white shadow-sm hover:bg-error/90',
        link: 'h-auto border-transparent bg-transparent p-0 text-kpi-navy underline underline-offset-4 hover:no-underline',
      },
      size: {
        xs: 'h-6 gap-1 rounded-md px-2 text-xs [&_svg]:h-3 [&_svg]:w-3',
        sm: 'h-8 gap-1.5 rounded-(--radius) px-3 text-sm [&_svg]:h-3.5 [&_svg]:w-3.5',
        md: 'h-9 gap-2 rounded-(--radius) px-4 text-sm [&_svg]:h-4 [&_svg]:w-4',
        default: 'h-9 gap-2 rounded-(--radius) px-4 text-sm [&_svg]:h-4 [&_svg]:w-4',
        lg: 'h-10 gap-2 rounded-lg px-5 text-sm [&_svg]:h-4 [&_svg]:w-4',
        xl: 'h-12 gap-2.5 rounded-lg px-6 text-base [&_svg]:h-5 [&_svg]:w-5',
        icon: 'h-9 w-9 rounded-(--radius) p-0 [&_svg]:h-4 [&_svg]:w-4',
        'icon-xs': 'h-6 w-6 rounded-md p-0 [&_svg]:h-3 [&_svg]:w-3',
        'icon-sm': 'h-8 w-8 rounded-(--radius) p-0 [&_svg]:h-3.5 [&_svg]:w-3.5',
        'icon-lg': 'h-10 w-10 rounded-lg p-0 [&_svg]:h-5 [&_svg]:w-5',
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
  ref?: React.Ref<HTMLButtonElement>;
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

        className={cn(
          buttonVariants({ variant, size }),
          fullWidth && 'w-full',
          isDisabled && 'pointer-events-none opacity-50',
          className,
        )}
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
