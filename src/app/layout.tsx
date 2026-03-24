import './globals.css';

import type { Metadata, Viewport } from 'next';
import { Bitter, Onest } from 'next/font/google';

import { APP_NAME } from '@/lib/config/client';
import { APP_URL } from '@/lib/config/server';
import { cn } from '@/lib/utils';
import { ToastProvider } from '@/providers/toast-provider';

const onest = Onest({
  subsets: ['latin', 'cyrillic'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
});

const bitter = Bitter({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
});

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
  return (
    <html lang="uk" className={cn('font-sans', onest.variable, bitter.variable)}>
      <head>
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
