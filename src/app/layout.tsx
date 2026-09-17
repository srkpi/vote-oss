import './globals.css';

import type { Metadata, Viewport } from 'next';
import { Bitter, Onest } from 'next/font/google';

import { CatgirlModeProvider } from '@/hooks/use-catgirl-mode';
import { ThemeProvider } from '@/hooks/use-theme';
import { APP_NAME, APP_URL } from '@/lib/config/client';
import { LOCAL_STORAGE_CATGIRL_MODE_KEY, LOCAL_STORAGE_THEME_KEY } from '@/lib/constants';
import { cn } from '@/lib/utils/common';
import { OPENGRAPH_IMAGE_DATA } from '@/lib/utils/metadata';
import { AvatarDeleteDialogProvider } from '@/providers/avatar-delete-dialog-provider';
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
    images: [OPENGRAPH_IMAGE_DATA],
  },
  twitter: {
    card: 'summary_large_image',
    title: title,
    description: description,
    images: [OPENGRAPH_IMAGE_DATA],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1c396e',
};

const THEME_INIT_SCRIPT = `
  (function() {
    try {
      var isDark = localStorage.getItem('${LOCAL_STORAGE_THEME_KEY}') === 'dark' ||
        (!localStorage.getItem('${LOCAL_STORAGE_THEME_KEY}') && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) {
        document.documentElement.classList.add('dark');
        var m = document.querySelector('meta[name="theme-color"]');
        if (m) m.setAttribute('content', '#0d111a');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
  })();
`;

// Sets the `.catgirl` class before first paint — same reasoning as
// THEME_INIT_SCRIPT above: everything the class controls (colors, the
// header logo, the hero scene fallback) must already be correct in the very
// first frame, not flipped in afterward by React once it hydrates.
const CATGIRL_INIT_SCRIPT = `
  (function() {
    try {
      if (localStorage.getItem('${LOCAL_STORAGE_CATGIRL_MODE_KEY}') === '1') {
        document.documentElement.classList.add('catgirl');
      }
    } catch (e) {}
  })();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="uk"
      className={cn('font-sans', onest.variable, bitter.variable)}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: CATGIRL_INIT_SCRIPT }} />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
      </head>
      <body>
        <ThemeProvider>
          <CatgirlModeProvider>
            <ToastProvider>
              <AvatarDeleteDialogProvider>{children}</AvatarDeleteDialogProvider>
            </ToastProvider>
          </CatgirlModeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
