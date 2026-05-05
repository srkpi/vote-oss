import { AlertCircle } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils/common';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('font-body text-foreground mb-1.5 block text-sm font-medium', className)}
      {...props}
    >
      {children}
      {required && (
        <span className="text-error ml-1" aria-hidden="true">
          *
        </span>
      )}
    </label>
  ),
);
Label.displayName = 'Label';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, leftIcon, rightIcon, type, ...props }, ref) => {
    if (leftIcon || rightIcon) {
      return (
        <div className="relative">
          {leftIcon && (
            <div className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              'flex h-10 w-full rounded-(--radius) bg-white',
              'border-border-color border',
              'font-body text-foreground px-3 py-2 text-sm',
              'placeholder:text-subtle',
              'transition-colors duration-150',
              'hover:border-kpi-blue-light',
              'focus:border-kpi-blue-light focus:ring-kpi-blue-light/20 focus:ring-2 focus:outline-none',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error && 'border-error focus:border-error focus:ring-error/20',
              'disabled:bg-surface disabled:cursor-not-allowed disabled:opacity-50',
              className,
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
              {rightIcon}
            </div>
          )}
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-(--radius) bg-white',
          'border-border-color border',
          'font-body text-foreground px-3 py-2 text-sm',
          'placeholder:text-subtle',
          'transition-colors duration-150',
          'hover:border-kpi-blue-light',
          'focus:border-kpi-blue-light focus:ring-kpi-blue-light/20 focus:ring-2 focus:outline-none',
          error && 'border-error focus:border-error focus:ring-error/20',
          'disabled:bg-surface disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <textarea
      className={cn(
        'flex min-h-20 w-full rounded-(--radius) bg-white',
        'border-border-color border',
        'font-body text-foreground px-3 py-2 text-sm',
        'placeholder:text-subtle',
        'resize-y',
        'transition-colors duration-150',
        'hover:border-kpi-blue-light',
        'focus:border-kpi-blue-light focus:ring-kpi-blue-light/20 focus:ring-2 focus:outline-none',
        error && 'border-error focus:border-error focus:ring-error/20',
        'disabled:bg-surface disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

interface FormFieldProps {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}

export function FormField({
  label,
  required,
  error,
  hint,
  children,
  className,
  htmlFor,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      )}
      {children}
      {hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
      {error && (
        <p className="text-error flex items-center gap-1 text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
