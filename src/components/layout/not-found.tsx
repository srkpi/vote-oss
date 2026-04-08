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
      <div className="font-display text-kpi-navy mb-6 text-7xl font-bold select-none sm:text-8xl">
        404
      </div>
      <h1 className="font-display text-foreground mb-3 text-2xl font-semibold sm:text-3xl">
        {title}
      </h1>
      <p className="font-body text-muted-foreground mb-8 max-w-md">{description}</p>
      <Link href={backHref} passHref>
        <Button variant="primary" size="lg" icon={<ChevronLeft className="h-5 w-5" />}>
          {backLabel}
        </Button>
      </Link>
    </div>
  );
}
