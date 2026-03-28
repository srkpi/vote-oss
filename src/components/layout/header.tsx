'use client';

import { ChevronDown, LogOut, Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import { APP_NAME } from '@/lib/config/client';
import type { StudyFormValue } from '@/lib/constants';
import { STUDY_FORM_LABELS } from '@/lib/constants';
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
    { label: 'FAQ', href: '/faq' },
    ...(session?.isAdmin ? [{ label: 'Адмін-панель', href: '/admin' }] : []),
  ];

  const handleLogout = async () => {
    setLoggingOut(true);
    const result = await api.auth.logout();
    if (result.success) {
      toast({ title: 'Вихід виконано', description: 'До побачення!', variant: 'success' });
      router.push('/login');
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
        'fixed top-0 right-0 left-0 z-40',
        'glass border-b border-white/60',
        'h-(--header-height)',
      )}
    >
      <div className="container flex h-full items-center justify-between">
        <Link href="/" className="group flex shrink-0 items-center gap-3">
          <Image src="/logo.svg" alt="Logo" height={32} width={32} preload />
          <div className="flex flex-col justify-center">
            <span className="font-display text-kpi-navy text-lg leading-tight font-semibold">
              {APP_NAME}
            </span>
            <span className="font-body text-muted-foreground text-[10px] tracking-widest uppercase">
              Система голосування
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'font-body rounded-(--radius) px-4 py-2 text-sm font-medium',
                'transition-all duration-150',
                pathname.startsWith(link.href)
                  ? 'bg-kpi-navy/10 text-kpi-navy'
                  : 'text-muted-foreground hover:bg-surface hover:text-foreground',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {session ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-1.5',
                  'hover:bg-surface transition-colors duration-150',
                  'font-body text-sm font-medium',
                )}
              >
                <div
                  className={cn(
                    'navy-gradient h-7 w-7 rounded-full',
                    'flex items-center justify-center',
                    'text-xs font-semibold text-white',
                  )}
                >
                  {session.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-foreground text-xs leading-tight font-semibold">
                    {session.fullName.split(' ')[0]}
                  </p>
                  <p className="text-muted-foreground text-[10px] leading-tight">
                    {session.faculty} · {session.group}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    'text-muted-foreground h-4 w-4 transition-transform duration-200',
                    userMenuOpen && 'rotate-180',
                  )}
                />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0" onClick={() => setUserMenuOpen(false)} />
                  <div
                    className={cn(
                      'absolute top-full right-0 mt-2 w-64',
                      'shadow-shadow-xl rounded-xl bg-white',
                      'border-border-color border',
                      'overflow-hidden',
                      'origin-top-right',
                    )}
                  >
                    <div className="space-y-3 px-4 py-4">
                      <div>
                        <p className="text-foreground text-sm font-semibold wrap-break-word">
                          {session.fullName}
                        </p>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {session.faculty} · {session.group}
                        </p>
                      </div>

                      {session.studyForm && (
                        <div>
                          <p className="text-muted-foreground mb-1 text-xs">Форма навчання:</p>
                          <p className="text-foreground text-sm leading-snug font-medium wrap-break-word">
                            {STUDY_FORM_LABELS[session.studyForm as StudyFormValue]}
                          </p>
                        </div>
                      )}

                      {session.speciality && (
                        <div>
                          <p className="text-muted-foreground mb-1 text-xs">Спеціальність:</p>
                          <p className="text-foreground text-sm leading-snug font-medium wrap-break-word">
                            {session.speciality}
                          </p>
                        </div>
                      )}

                      {session.isAdmin && (
                        <span className="bg-kpi-orange inline-block rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide text-white uppercase">
                          Адміністратор
                        </span>
                      )}
                    </div>

                    <div className="border-border-subtle border-t" />

                    <Button
                      size="lg"
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="text-error hover:bg-error-bg flex w-full items-center gap-2.5 bg-white text-sm transition-colors disabled:opacity-50"
                    >
                      <LogOut className="h-4 w-4" />
                      {loggingOut ? 'Виходимо…' : 'Вийти'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Button variant="primary" size="sm" asChild>
              <Link href="/login">Увійти</Link>
            </Button>
          )}

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={cn(
              'rounded-(--radius) p-2 md:hidden',
              'text-muted-foreground hover:bg-surface',
              'transition-colors',
            )}
            aria-label="Меню"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className={cn(
              'absolute top-full right-0 left-0 md:hidden',
              'border-border-color border-b bg-white',
              'shadow-shadow-lg',
              'animate-fade-down',
            )}
          >
            <nav className="container flex flex-col gap-1 py-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'font-body rounded-(--radius) px-4 py-3 text-sm font-medium',
                    'transition-colors duration-150',
                    pathname.startsWith(link.href)
                      ? 'bg-kpi-navy/10 text-kpi-navy'
                      : 'text-foreground hover:bg-surface',
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
