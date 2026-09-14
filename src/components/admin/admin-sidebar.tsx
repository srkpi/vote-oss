'use client';

import {
  CircleQuestionMark,
  FileText,
  Key,
  LayoutGrid,
  LogOut,
  Megaphone,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  Unlock,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useTheme } from '@/hooks/use-theme';
import { APP_NAME } from '@/lib/config/client';
import { cn } from '@/lib/utils/common';

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
    icon: <ShieldCheck className="h-4 w-4" />,
  },
];

const TOKENS_NAV_ITEM = {
  label: 'Токени',
  href: '/admin/tokens',
  exact: true,
  icon: <Key className="h-4 w-4" />,
};

const BYPASS_NAV_ITEM = {
  label: 'Доступ',
  href: '/admin/bypass',
  exact: true,
  icon: <Unlock className="h-4 w-4" />,
};

const GROUPS_NAV_ITEM = {
  label: 'Групи',
  href: '/admin/groups',
  exact: true,
  icon: <UsersRound className="h-4 w-4" />,
};

const PETITIONS_NAV_ITEM = {
  label: 'Петиції',
  href: '/admin/petitions',
  exact: true,
  icon: <Megaphone className="h-4 w-4" />,
};

const FAQ_NAV_ITEM = {
  label: 'FAQ',
  href: '/admin/faq',
  exact: true,
  icon: <CircleQuestionMark className="h-4 w-4" />,
};

interface AdminSidebarProps {
  manageAdmins?: boolean;
  manageGroups?: boolean;
  managePetitions?: boolean;
  manageFaq?: boolean;
  restrictedToFaculty?: boolean;
}

export function AdminSidebar({
  manageAdmins = false,
  manageGroups = false,
  managePetitions = false,
  manageFaq = false,
  restrictedToFaculty = true,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const navItems = [...BASE_NAV_ITEMS];

  if (manageAdmins) {
    navItems.push(TOKENS_NAV_ITEM);
  }

  if (!restrictedToFaculty) {
    navItems.push(BYPASS_NAV_ITEM);
  }

  if (manageGroups) {
    navItems.push(GROUPS_NAV_ITEM);
  }

  if (managePetitions) {
    navItems.push(PETITIONS_NAV_ITEM);
  }

  if (manageFaq) {
    navItems.push(FAQ_NAV_ITEM);
  }

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <>
      <aside className="border-border-subtle bg-card sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r lg:flex">
        <div className="border-border-subtle border-b p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="bg-kpi-orange flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm">
                <Settings className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-foreground truncate text-sm leading-tight font-semibold">
                  Адмін-панель
                </p>
                <p className="font-body text-muted-foreground truncate text-[10px] tracking-wider uppercase">
                  {APP_NAME}
                </p>
              </div>
            </div>
            <ThemeToggle className="shrink-0" />
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
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
                  ? 'bg-kpi-navy text-white shadow-sm'
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
            className="font-body text-muted-foreground hover:bg-error-bg hover:text-error flex items-center gap-3 rounded-(--radius) px-3 py-2.5 text-sm font-medium transition-all duration-150"
          >
            <LogOut className="h-4 w-4" />
            На головну
          </Link>
        </div>
      </aside>

      <div className="safe-area-pb border-border-subtle bg-card fixed right-0 bottom-0 left-0 z-40 border-t shadow-[0_-4px_12px_rgb(28_57_110/0.08)] lg:hidden dark:shadow-[0_-4px_12px_rgb(0_0_0/0.4)]">
        <div className="flex scrollbar-none items-stretch overflow-x-auto [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {navItems.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 px-1 py-2.5 text-center',
                  'min-h-14 min-w-20 transition-all duration-150',
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
          <button
            type="button"
            onClick={toggleTheme}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 px-1 py-2.5 text-center',
              'min-h-14 min-w-20 shrink-0 transition-all duration-150',
              'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="flex h-6 w-8 items-center justify-center rounded-lg transition-all duration-150">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </span>
            <span className="font-body text-[10px] leading-tight font-medium">Тема</span>
          </button>
        </div>
      </div>
    </>
  );
}
