'use client';

import {
  CircleQuestionMark,
  FileText,
  Key,
  LayoutGrid,
  LogOut,
  Settings,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { APP_NAME } from '@/lib/config/client';
import { cn } from '@/lib/utils';

const BASE_NAV_ITEMS = [
  {
    label: 'Огляд',
    href: '/admin',
    exact: true,
    icon: <LayoutGrid className="h-4 w-4" />,
  },
  {
    label: 'Голосування',
    href: '/admin/elections',
    exact: false,
    icon: <FileText className="h-4 w-4" />,
  },
  {
    label: 'Адміністратори',
    href: '/admin/admins',
    exact: true,
    icon: <Users className="h-4 w-4" />,
  },
];

const TOKENS_NAV_ITEM = {
  label: 'Токени',
  href: '/admin/tokens',
  exact: true,
  icon: <Key className="h-4 w-4" />,
};

const FAQ_NAV_ITEM = {
  label: 'FAQ',
  href: '/admin/faq',
  exact: true,
  icon: <CircleQuestionMark className="h-4 w-4" />,
};

interface AdminSidebarProps {
  manageAdmins?: boolean;
  restrictedToFaculty?: boolean;
}

export function AdminSidebar({
  manageAdmins = false,
  restrictedToFaculty = true,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const navItems = [...BASE_NAV_ITEMS];

  if (manageAdmins) {
    navItems.push(TOKENS_NAV_ITEM);
  }

  if (!restrictedToFaculty) {
    navItems.push(FAQ_NAV_ITEM);
  }

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <>
      <aside className="border-border-subtle hidden w-60 shrink-0 flex-col border-r bg-white lg:flex">
        <div className="border-border-subtle border-b p-5">
          <div className="flex items-center gap-3">
            <div className="bg-kpi-orange shadow-shadow-sm flex h-9 w-9 items-center justify-center rounded-lg">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-display text-foreground text-sm leading-tight font-semibold">
                Адмін-панель
              </p>
              <p className="font-body text-muted-foreground text-[10px] tracking-wider uppercase">
                {APP_NAME}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 p-3">
          <p className="font-body text-muted-foreground px-3 pt-3 pb-2 text-[10px] font-semibold tracking-widest uppercase">
            Навігація
          </p>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'font-body flex items-center gap-3 rounded-(--radius) px-3 py-2.5 text-sm font-medium',
                'transition-all duration-150',
                isActive(item.href, item.exact)
                  ? 'bg-kpi-navy shadow-shadow-sm text-white'
                  : 'text-muted-foreground hover:bg-surface hover:text-foreground',
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto p-3">
          <hr className="border-border-subtle mb-3" />
          <Link
            href="/"
            className="font-body text-muted-foreground flex items-center gap-3 rounded-(--radius) px-3 py-2.5 text-sm font-medium transition-all duration-150 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            На головну
          </Link>
        </div>
      </aside>

      <div className="safe-area-pb border-border-subtle fixed right-0 bottom-0 left-0 z-40 border-t bg-white shadow-[0_-4px_12px_rgb(28_57_110/0.08)] lg:hidden">
        <div className="flex items-stretch">
          {navItems.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 px-1 py-2.5 text-center',
                  'min-h-14 transition-all duration-150',
                  active ? 'text-kpi-navy' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-8 items-center justify-center rounded-lg transition-all duration-150',
                    active && 'bg-kpi-navy/10',
                  )}
                >
                  {item.icon}
                </span>
                <span className="font-body text-[10px] leading-tight font-medium">
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
