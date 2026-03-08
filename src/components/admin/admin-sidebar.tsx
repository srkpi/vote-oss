'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

interface AdminSidebarProps {
  session: User;
}

const NAV_ITEMS = [
  {
    label: 'Огляд',
    href: '/admin',
    exact: true,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
        />
      </svg>
    ),
  },
  {
    label: 'Голосування',
    href: '/admin/elections',
    exact: false,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    label: 'Адміністратори',
    href: '/admin/admins',
    exact: false,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
  },
];

export function AdminSidebar({ session }: AdminSidebarProps) {
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
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
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

        {/* User info footer */}
        <div className="p-3 border-t border-[var(--border-subtle)]">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full navy-gradient flex items-center justify-center text-white text-xs font-semibold shrink-0">
              {session.fullName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[var(--foreground)] truncate font-body">
                {session.fullName.split(' ')[0]}
              </p>
              <p className="text-[10px] text-[var(--muted-foreground)] font-body">
                {session.faculty} · {session.group}
              </p>
            </div>
          </div>
          <Link
            href="/elections"
            className={cn(
              'mt-1 flex items-center gap-2 px-3 py-2 rounded-[var(--radius)] text-xs font-body',
              'text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]',
              'transition-colors duration-150',
            )}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            На головну
          </Link>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-[var(--border-subtle)] px-4 py-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-xs font-medium font-body whitespace-nowrap',
                'transition-all duration-150',
                isActive(item.href, item.exact)
                  ? 'bg-[var(--kpi-navy)] text-white'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--surface)]',
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
