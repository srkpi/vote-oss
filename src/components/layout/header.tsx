'use client';

import { CheckCircle, ChevronDown, LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { logout } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { User } from '@/types/auth';

interface HeaderProps {
  session: User | null;
}

export function Header({ session }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const navLinks = [
    { label: 'Голосування', href: '/elections' },
    ...(session?.isAdmin ? [{ label: 'Адмін-панель', href: '/admin' }] : []),
  ];

  const handleLogout = async () => {
    setLoggingOut(true);
    const result = await logout();
    if (result.success) {
      toast({ title: 'Вихід виконано', description: 'До побачення!', variant: 'success' });
      router.push('/auth/login');
      router.refresh();
    } else {
      toast({ title: 'Помилка виходу', description: result.error, variant: 'error' });
    }
    setLoggingOut(false);
    setUserMenuOpen(false);
  };

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-40',
        'glass border-b border-white/60',
        'h-[var(--header-height)]',
      )}
    >
      <div className="container h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          <div
            className={cn(
              'w-8 h-8 rounded-lg navy-gradient',
              'flex items-center justify-center',
              'transition-transform duration-200 group-hover:scale-105',
            )}
          >
            <CheckCircle className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <span className="font-display text-lg font-semibold text-[var(--kpi-navy)] leading-tight block">
              КПІ Голос
            </span>
            <span className="text-[10px] font-body text-[var(--muted-foreground)] uppercase tracking-widest leading-none">
              Система голосування
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'px-4 py-2 rounded-[var(--radius)] text-sm font-medium font-body',
                'transition-all duration-150',
                pathname.startsWith(link.href)
                  ? 'bg-[var(--kpi-navy)]/10 text-[var(--kpi-navy)]'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right section */}
        <div className="flex items-center gap-3">
          {session ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-lg)]',
                  'hover:bg-[var(--surface)] transition-colors duration-150',
                  'text-sm font-medium font-body',
                )}
              >
                <div
                  className={cn(
                    'w-7 h-7 rounded-full navy-gradient',
                    'flex items-center justify-center',
                    'text-white text-xs font-semibold',
                  )}
                >
                  {session.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-[var(--foreground)] leading-tight">
                    {session.fullName.split(' ')[0]}
                  </p>
                  <p className="text-[10px] text-[var(--muted-foreground)] leading-tight">
                    {session.faculty} · {session.group}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-[var(--muted-foreground)] transition-transform duration-200',
                    userMenuOpen && 'rotate-180',
                  )}
                />
              </button>

              {/* Dropdown */}
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0" onClick={() => setUserMenuOpen(false)} />
                  <div
                    className={cn(
                      'absolute right-0 top-full mt-2 w-56',
                      'bg-white rounded-[var(--radius-xl)] shadow-[var(--shadow-xl)]',
                      'border border-[var(--border-color)]',
                      'overflow-hidden',
                      'animate-scale-in origin-top-right',
                    )}
                  >
                    <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
                      <p className="text-xs text-[var(--muted-foreground)]">Увійдено як</p>
                      <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                        {session.fullName}
                      </p>
                      {session.isAdmin && (
                        <span className="inline-block mt-1 text-[10px] font-semibold text-white bg-[var(--kpi-orange)] px-2 py-0.5 rounded-full uppercase tracking-wide">
                          Адміністратор
                        </span>
                      )}
                    </div>

                    <div className="py-1">
                      <button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors disabled:opacity-50"
                      >
                        <LogOut className="w-4 h-4" />
                        {loggingOut ? 'Виходимо…' : 'Вийти'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Button variant="primary" size="sm" asChild>
              <Link href="/auth/login">Увійти</Link>
            </Button>
          )}

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={cn(
              'md:hidden p-2 rounded-[var(--radius)]',
              'text-[var(--muted-foreground)] hover:bg-[var(--surface)]',
              'transition-colors',
            )}
            aria-label="Меню"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav Drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className={cn(
              'absolute top-full left-0 right-0 md:hidden',
              'bg-white border-b border-[var(--border-color)]',
              'shadow-[var(--shadow-lg)]',
              'animate-fade-down',
            )}
          >
            <nav className="container py-3 flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'px-4 py-3 rounded-[var(--radius)] text-sm font-medium font-body',
                    'transition-colors duration-150',
                    pathname.startsWith(link.href)
                      ? 'bg-[var(--kpi-navy)]/10 text-[var(--kpi-navy)]'
                      : 'text-[var(--foreground)] hover:bg-[var(--surface)]',
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
