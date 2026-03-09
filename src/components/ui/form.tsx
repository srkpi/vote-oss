import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ==================== LABEL ====================

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        'block text-sm font-medium text-[var(--foreground)] mb-1.5 font-body',
        className,
      )}
      {...props}
    >
      {children}
      {required && (
        <span className="ml-1 text-[var(--error)]" aria-hidden="true">
          *
        </span>
      )}
    </label>
  ),
);
Label.displayName = 'Label';

// ==================== INPUT ====================

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
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              'flex h-10 w-full rounded-[var(--radius)] bg-white',
              'border border-[var(--border-color)]',
              'px-3 py-2 text-sm font-body text-[var(--foreground)]',
              'placeholder:text-[var(--subtle)]',
              'transition-colors duration-150',
              'hover:border-[var(--kpi-blue-light)]',
              'focus:outline-none focus:border-[var(--kpi-blue-light)] focus:ring-2 focus:ring-[var(--kpi-blue-light)]/20',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error &&
                'border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]/20',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--surface)]',
              className,
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none">
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
          'flex h-10 w-full rounded-[var(--radius)] bg-white',
          'border border-[var(--border-color)]',
          'px-3 py-2 text-sm font-body text-[var(--foreground)]',
          'placeholder:text-[var(--subtle)]',
          'transition-colors duration-150',
          'hover:border-[var(--kpi-blue-light)]',
          'focus:outline-none focus:border-[var(--kpi-blue-light)] focus:ring-2 focus:ring-[var(--kpi-blue-light)]/20',
          error && 'border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]/20',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--surface)]',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

// ==================== TEXTAREA ====================

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-[var(--radius)] bg-white',
        'border border-[var(--border-color)]',
        'px-3 py-2 text-sm font-body text-[var(--foreground)]',
        'placeholder:text-[var(--subtle)]',
        'resize-y',
        'transition-colors duration-150',
        'hover:border-[var(--kpi-blue-light)]',
        'focus:outline-none focus:border-[var(--kpi-blue-light)] focus:ring-2 focus:ring-[var(--kpi-blue-light)]/20',
        error && 'border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]/20',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--surface)]',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

// ==================== SELECT ====================

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => (
    <select
      className={cn(
        'flex h-10 w-full rounded-[var(--radius)] bg-white',
        'border border-[var(--border-color)]',
        'px-3 py-2 text-sm font-body text-[var(--foreground)]',
        'appearance-none',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")]",
        'bg-no-repeat bg-[right_12px_center]',
        'pr-10',
        'cursor-pointer',
        'transition-colors duration-150',
        'hover:border-[var(--kpi-blue-light)]',
        'focus:outline-none focus:border-[var(--kpi-blue-light)] focus:ring-2 focus:ring-[var(--kpi-blue-light)]/20',
        error && 'border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]/20',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--surface)]',
        className,
      )}
      ref={ref}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

// ==================== FORM FIELD (wrapper) ====================

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
      {hint && !error && <p className="text-xs text-[var(--muted-foreground)]">{hint}</p>}
      {error && (
        <p className="text-xs text-[var(--error)] flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
