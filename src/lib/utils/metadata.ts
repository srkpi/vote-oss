import { APP_NAME, APP_URL } from '@/lib/config/client';

export const OPENGRAPH_IMAGE_DATA = {
  url: new URL('/opengraph-image', APP_URL),
  width: 1200,
  height: 630,
  alt: `${APP_NAME} — Система електронного голосування`,
};
