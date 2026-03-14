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
        'py-16 px-8',
        className,
      )}
    >
      <div className="w-16 h-16 rounded-2xl bg-[var(--error-bg)] border border-[var(--error)]/20 flex items-center justify-center mb-5">
        <AlertTriangle className="w-8 h-8 text-[var(--error)]" />
      </div>
      <h3 className="font-display text-xl font-semibold text-[var(--foreground)] mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--muted-foreground)] max-w-sm font-body">{description}</p>
      )}
      {onRetry && (
        <Button variant="outline" size="md" className="mt-6" onClick={onRetry}>
          Спробувати знову
        </Button>
      )}
    </div>
  );
}
