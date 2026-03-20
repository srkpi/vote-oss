import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

export interface NavItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  nav?: NavItem[];
  title: string;
  description?: string;
  children?: React.ReactNode;
  isContainer?: boolean;
}

export function PageHeader({ nav, title, description, children, isContainer }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'border-border-subtle border-b bg-white py-4 sm:py-6',
        !isContainer && 'px-4 sm:px-8',
      )}
    >
      <div className={cn('flex items-center justify-between gap-3', isContainer && 'container')}>
        <div className="min-w-0">
          {nav && nav.length > 0 && (
            <nav className="font-body text-muted-foreground mb-2 flex items-center gap-2 text-sm sm:mb-3">
              {nav.map((item, index) => {
                const isLast = index === nav.length - 1;
                return (
                  <span key={index} className="flex items-center gap-2">
                    {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                    {isLast || !item.href ? (
                      <span className={isLast ? 'text-foreground' : 'text-muted-foreground'}>
                        {item.label}
                      </span>
                    ) : (
                      <Link href={item.href} className="hover:text-kpi-navy transition-colors">
                        {item.label}
                      </Link>
                    )}
                  </span>
                );
              })}
            </nav>
          )}
          <h1 className="font-display text-foreground text-2xl leading-tight font-bold wrap-break-word sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="font-body text-muted-foreground mt-0.5 text-sm wrap-break-word">
              {description}
            </p>
          )}
        </div>
        {children && <div className="shrink-0">{children}</div>}
      </div>
    </div>
  );
}
