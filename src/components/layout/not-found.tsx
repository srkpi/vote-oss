import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NotFoundProps {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  className?: string;
}

export function NotFound({
  title = 'Тут нічого немає',
  description = 'Сторінка не існує або була видалена',
  backHref = '/',
  backLabel = 'На головну',
  className = '',
}: NotFoundProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center text-center py-24 px-4 sm:px-8',
        className,
      )}
    >
      <div className="font-display text-7xl sm:text-8xl font-bold text-[var(--kpi-navy)] mb-6 select-none">
        404
      </div>
      <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--foreground)] mb-3">
        {title}
      </h1>
      <p className="text-[var(--muted-foreground)] max-w-md font-body mb-8">{description}</p>
      <Link href={backHref} passHref>
        <Button variant="primary" size="lg" icon={<ChevronLeft className="w-5 h-5" />}>
          {backLabel}
        </Button>
      </Link>
    </div>
  );
}
