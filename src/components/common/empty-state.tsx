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
        'px-8 py-16',
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            'h-16 w-16 rounded-2xl',
            'border-border-subtle bg-surface border',
            'mb-5 flex items-center justify-center',
            'text-kpi-gray-mid',
          )}
        >
          {icon}
        </div>
      )}
      <h3 className="font-display text-foreground mb-2 text-xl font-semibold">{title}</h3>
      {description && (
        <p className="font-body text-muted-foreground max-w-sm text-sm leading-relaxed wrap-break-word">
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
