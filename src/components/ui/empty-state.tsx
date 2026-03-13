import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'py-16 px-8',
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            'w-16 h-16 rounded-2xl',
            'bg-[var(--surface)] border border-[var(--border-subtle)]',
            'flex items-center justify-center mb-5',
            'text-[var(--kpi-gray-mid)]',
          )}
        >
          {icon}
        </div>
      )}
      <h3 className="font-display text-xl font-semibold text-[var(--foreground)] mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--muted-foreground)] max-w-sm font-body leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-6">
          {action.href ? (
            <Button variant="primary" size="md" asChild>
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ) : (
            <Button variant="primary" size="md" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
