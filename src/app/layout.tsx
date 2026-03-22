import './globals.css';

import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';

import { PageLayout } from '@/components/layout/page-layout';
import { APP_NAME } from '@/lib/config/client';
import { APP_URL } from '@/lib/config/server';
import { getServerSession } from '@/lib/server-auth';
import { cn } from '@/lib/utils';
import { ToastProvider } from '@/providers/toast-provider';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });
const title = `${APP_NAME} — Система електронного голосування`;
const description =
  'Безпечна система електронного голосування для студентів КПІ ім. Ігоря Сікорського.';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: title,
    template: `%s | ${APP_NAME}`,
  },
  description: description,
  keywords: ['голосування', 'вибори', 'студенти', 'КПІ', 'КПІ ім. Ігоря Сікорського'],
  openGraph: {
    type: 'website',
    locale: 'uk_UA',
    siteName: APP_NAME,
    title: title,
    description: description,
  },
  twitter: {
    card: 'summary_large_image',
    title: title,
    description: description,
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
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
      </head>
      <body>
        <ToastProvider>
          <PageLayout session={session}>{children}</PageLayout>
        </ToastProvider>
      </body>
    </html>
  );
}
