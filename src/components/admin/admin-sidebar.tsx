'use client';

import { FileText, LayoutGrid, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  {
    label: 'Огляд',
    href: '/admin',
    exact: true,
    icon: <LayoutGrid className="w-4 h-4" />,
  },
  {
    label: 'Голосування',
    href: '/admin/elections',
    exact: false,
    icon: <FileText className="w-4 h-4" />,
  },
  {
    label: 'Адміністратори',
    href: '/admin/admins',
    exact: false,
    icon: <Users className="w-4 h-4" />,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-[var(--border-subtle)] bg-white">
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--kpi-orange)] flex items-center justify-center shadow-[var(--shadow-sm)]">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-display text-sm font-semibold text-[var(--foreground)] leading-tight">
                Адмін-панель
              </p>
              <p className="text-[10px] font-body text-[var(--muted-foreground)] uppercase tracking-wider">
                КПІ Голос
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5">
          <p className="px-3 pt-3 pb-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest font-body">
            Навігація
          </p>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius)] text-sm font-medium font-body',
                'transition-all duration-150',
                isActive(item.href, item.exact)
                  ? 'bg-[var(--kpi-navy)] text-white shadow-[var(--shadow-sm)]'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]',
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile bottom navigation bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[var(--border-subtle)] shadow-[0_-4px_12px_rgb(28_57_110/0.08)] safe-area-pb">
        <div className="flex items-stretch">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 text-center',
                  'transition-all duration-150 min-h-[56px]',
                  active
                    ? 'text-[var(--kpi-navy)]'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
                )}
              >
                <span
                  className={cn(
                    'flex items-center justify-center w-8 h-6 rounded-lg transition-all duration-150',
                    active && 'bg-[var(--kpi-navy)]/10',
                  )}
                >
                  {item.icon}
                </span>
                <span className="text-[10px] font-body font-medium leading-tight">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
