import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// ==================== EMPTY STATE ====================

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

// ==================== ERROR STATE ====================

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Щось пішло не так',
  description = 'Виникла помилка під час завантаження даних.',
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
        <svg
          className="w-8 h-8 text-[var(--error)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 className="font-display text-xl font-semibold text-[var(--foreground)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--muted-foreground)] max-w-sm font-body">{description}</p>
      {onRetry && (
        <Button variant="outline" size="md" className="mt-6" onClick={onRetry}>
          Спробувати знову
        </Button>
      )}
    </div>
  );
}

// ==================== LOADING FULL PAGE ====================

export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-[var(--border-color)]" />
        <div className="absolute inset-0 rounded-full border-4 border-[var(--kpi-navy)] border-t-transparent animate-spin" />
      </div>
      <p className="text-sm text-[var(--muted-foreground)] font-body">Завантаження…</p>
    </div>
  );
}

// ==================== NOT FOUND ====================

export function NotFoundState({
  title = 'Сторінку не знайдено',
  description = 'Запитана сторінка не існує або була видалена.',
  backHref = '/',
}: {
  title?: string;
  description?: string;
  backHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-8">
      <div className="font-display text-8xl font-bold text-[var(--border-color)] mb-6 select-none">
        404
      </div>
      <h1 className="font-display text-3xl font-semibold text-[var(--foreground)] mb-3">{title}</h1>
      <p className="text-[var(--muted-foreground)] max-w-md font-body mb-8">{description}</p>
      <Button variant="primary" size="lg" asChild>
        <Link href={backHref}>Повернутися назад</Link>
      </Button>
    </div>
  );
}
