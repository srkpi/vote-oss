import './globals.css';

import type { Metadata, Viewport } from 'next';

import { CatgirlModeProvider } from '@/hooks/use-catgirl-mode';
import { ThemeProvider } from '@/hooks/use-theme';
import { APP_NAME, APP_URL } from '@/lib/config/client';
import { LOCAL_STORAGE_CATGIRL_MODE_KEY, LOCAL_STORAGE_THEME_KEY } from '@/lib/constants';
import { OPENGRAPH_IMAGE_DATA } from '@/lib/utils/metadata';
import { AvatarDeleteDialogProvider } from '@/providers/avatar-delete-dialog-provider';
import { ToastProvider } from '@/providers/toast-provider';

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
    <html lang="uk" className="font-sans" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* App Router root layout loads fonts globally. */}
        {}
        {/* oxlint-disable-next-line nextjs/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bitter:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&family=Onest:wght@300;400;500;600;700&display=swap"
        />
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
