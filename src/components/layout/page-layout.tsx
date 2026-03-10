'use client';

import { usePathname } from 'next/navigation';

import { Header } from '@/components/layout/header';
import { cn } from '@/lib/utils';
import type { User } from '@/types/auth';

const hideHeaderPaths = ['/auth/login'];

interface PageLayoutProps {
  session: User | null;
  children: React.ReactNode;
}

export function PageLayout({ session, children }: PageLayoutProps) {
  const pathname = usePathname();
  const withHeader = !hideHeaderPaths.some((p) => pathname.startsWith(p));

  return (
    <div className="flex flex-col min-h-screen">
      {withHeader && <Header session={session} />}
      <main className={cn('flex-1', withHeader && 'pt-[var(--header-height)]')}>{children}</main>
    </div>
  );
}
