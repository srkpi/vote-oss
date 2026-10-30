import { AlertCircle } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils/common';

export interface LabelProps extends React.ComponentProps<'label'> {
  required?: boolean;
}

export function Label({ className, required, children, ...props }: LabelProps) {
  return (
    <label
      className={cn('font-body mb-1.5 block text-sm font-medium text-foreground', className)}
      {...props}
    >
      {children}
      {required && <span className="ml-1 text-error">*</span>}
    </label>
  );
}

export interface InputProps extends React.ComponentProps<'input'> {
  error?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Input({ className, error, leftIcon, rightIcon, type, ...props }: InputProps) {
  if (leftIcon || rightIcon) {
    return (
      <div className="relative">
        {leftIcon && (
          <div className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
            {leftIcon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            'flex h-10 w-full rounded-(--radius) bg-card',
            'border-border-color border',
            'font-body px-3 py-2 text-sm text-foreground',
            'placeholder:text-subtle',
            'transition-colors duration-150',
            'hover:border-kpi-blue-light',
            'focus:border-kpi-blue-light focus:ring-2 focus:ring-kpi-blue-light/20 focus:outline-none',
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            error && 'border-error focus:border-error focus:ring-error/20',
            'disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-50',
            className,
          )}
          {...props}
        />
        {rightIcon && (
          <div className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
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
        'flex h-10 w-full rounded-(--radius) bg-card',
        'border-border-color border',
        'font-body px-3 py-2 text-sm text-foreground',
        'placeholder:text-subtle',
        'transition-colors duration-150',
        'hover:border-kpi-blue-light',
        'focus:border-kpi-blue-light focus:ring-2 focus:ring-kpi-blue-light/20 focus:outline-none',
        error && 'border-error focus:border-error focus:ring-error/20',
        'disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export interface TextareaProps extends React.ComponentProps<'textarea'> {
  error?: boolean;
}

export function Textarea({ className, error, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'flex min-h-20 w-full rounded-(--radius) bg-card',
        'border-border-color border',
        'font-body px-3 py-2 text-sm text-foreground',
        'placeholder:text-subtle',
        'resize-y',
        'transition-colors duration-150',
        'hover:border-kpi-blue-light',
        'focus:border-kpi-blue-light focus:ring-2 focus:ring-kpi-blue-light/20 focus:outline-none',
        error && 'border-error focus:border-error focus:ring-error/20',
        'disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

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
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="flex items-center gap-1 text-xs text-error">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
