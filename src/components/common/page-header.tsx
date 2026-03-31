import { ChevronLeft, ChevronRight } from 'lucide-react';
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
  backHref?: string;
  backClassName?: string;
}

export function PageHeader({
  nav,
  title,
  description,
  children,
  isContainer,
  backHref,
  backClassName,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'border-border-subtle border-b bg-white py-4 sm:py-6',
        !isContainer && 'px-4 sm:px-8',
      )}
    >
      <div
        className={cn(
          'flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-3',
          isContainer && 'container',
        )}
      >
        <div className="flex min-w-0 items-start gap-4">
          {backHref && (
            <Link
              href={backHref}
              className={cn(
                'border-border-subtle hover:bg-surface text-muted-foreground hover:text-foreground',
                'mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                'border transition-all duration-200',
                backClassName,
              )}
              aria-label="Назад"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
          )}

          <div className="min-w-0 flex-1">
            {nav && nav.length > 0 && (
              <nav
                className={cn(
                  'font-body text-muted-foreground mb-2 flex items-center gap-x-2 gap-y-1 text-sm sm:mb-3',
                  'flex-wrap', // Allows breadcrumbs to wrap to a second line if needed
                )}
              >
                {nav.map((item, index) => {
                  const isLast = index === nav.length - 1;
                  return (
                    <span key={index} className="flex min-w-0 items-center gap-2">
                      {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                      {isLast || !item.href ? (
                        <span
                          className={cn(
                            'max-w-37.5 truncate sm:max-w-75', // Truncates very long titles
                            isLast ? 'text-foreground font-medium' : 'text-muted-foreground',
                          )}
                        >
                          {item.label}
                        </span>
                      ) : (
                        <Link
                          href={item.href}
                          className="hover:text-kpi-navy max-w-30 truncate transition-colors sm:max-w-none"
                        >
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
              <p className="font-body text-muted-foreground mt-1 text-sm wrap-break-word">
                {description}
              </p>
            )}
          </div>
        </div>

        {children && (
          <div className="flex shrink-0 items-center gap-2 overflow-x-auto pb-1 lg:justify-end">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
