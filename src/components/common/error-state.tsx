import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Щось пішло не так',
  description,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'px-8 py-16',
        className,
      )}
    >
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-(--error)/20 bg-(--error-bg)">
        <AlertTriangle className="h-8 w-8 text-(--error)" />
      </div>
      <h3 className="font-display mb-2 text-xl font-semibold text-(--foreground)">{title}</h3>
      {description && (
        <p className="font-body max-w-sm text-sm text-(--muted-foreground)">{description}</p>
      )}
      {onRetry && (
        <Button variant="outline" size="md" className="mt-6" onClick={onRetry}>
          Спробувати знову
        </Button>
      )}
    </div>
  );
}
