import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

export interface NavItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  nav?: NavItem[];
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageHeader({ nav, title, description, children }: PageHeaderProps) {
  return (
    <div className="bg-white border-b border-[var(--border-subtle)] px-4 sm:px-8 py-4 sm:py-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {nav && nav.length > 0 && (
            <nav className="flex items-center gap-2 text-sm font-body text-[var(--muted-foreground)] mb-2 sm:mb-3">
              {nav.map((item, index) => {
                const isLast = index === nav.length - 1;
                return (
                  <span key={index} className="flex items-center gap-2">
                    {index > 0 && <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                    {isLast || !item.href ? (
                      <span
                        className={
                          isLast ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'
                        }
                      >
                        {item.label}
                      </span>
                    ) : (
                      <Link
                        href={item.href}
                        className="hover:text-[var(--kpi-navy)] transition-colors"
                      >
                        {item.label}
                      </Link>
                    )}
                  </span>
                );
              })}
            </nav>
          )}

          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--foreground)] leading-tight break-words">
            {title}
          </h1>

          {description && (
            <p className="font-body text-sm text-[var(--muted-foreground)] mt-0.5 break-words">
              {description}
            </p>
          )}
        </div>

        {children && <div className="shrink-0">{children}</div>}
      </div>
    </div>
  );
}
