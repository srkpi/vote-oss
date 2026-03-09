import type { Metadata, Viewport } from 'next';
import './globals.css';

import { PageLayout } from '@/components/layout/page-layout';
import { ToastProvider } from '@/providers/toast-provider';
import { getServerSession } from '@/lib/server-auth';
import { Geist } from 'next/font/google';
import { cn } from '@/lib/utils';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: {
    default: 'КПІ Голос — Система електронного голосування',
    template: '%s | КПІ Голос',
  },
  description:
    'Безпечна система електронного голосування для студентів і викладачів КПІ ім. Ігоря Сікорського.',
  keywords: ['КПІ', 'голосування', 'вибори', 'студенти', 'КПІ Сікорського'],
  authors: [{ name: 'КПІ ім. Ігоря Сікорського' }],
  openGraph: {
    type: 'website',
    locale: 'uk_UA',
    siteName: 'КПІ Голос',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1c396e',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  return (
    <html lang="uk" className={cn('font-sans', geist.variable)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <ToastProvider>
          <PageLayout session={session}>{children}</PageLayout>
        </ToastProvider>
      </body>
    </html>
  );
}
