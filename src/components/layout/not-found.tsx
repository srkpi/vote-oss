import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/common';

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
        'flex flex-col items-center justify-center px-4 py-24 text-center sm:px-8',
        className,
      )}
    >
      <div className="mb-6 font-display text-7xl font-bold text-kpi-navy select-none sm:text-8xl">
        404
      </div>
      <h1 className="mb-3 font-display text-2xl font-semibold text-foreground sm:text-3xl">
        {title}
      </h1>
      <p className="font-body mb-8 max-w-md text-muted-foreground">{description}</p>
      <Link href={backHref} passHref>
        <Button variant="primary" size="lg" icon={<ChevronLeft className="h-5 w-5" />}>
          {backLabel}
        </Button>
      </Link>
    </div>
  );
}
