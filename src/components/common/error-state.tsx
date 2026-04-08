import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/common';

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
      <div className="border-error/20 bg-error-bg mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border">
        <AlertTriangle className="text-error h-8 w-8" />
      </div>
      <h3 className="font-display text-foreground mb-2 text-xl font-semibold">{title}</h3>
      {description && (
        <p className="font-body text-muted-foreground max-w-sm text-sm">{description}</p>
      )}
      {onRetry && (
        <Button variant="outline" size="md" className="mt-6" onClick={onRetry}>
          Спробувати знову
        </Button>
      )}
    </div>
  );
}
