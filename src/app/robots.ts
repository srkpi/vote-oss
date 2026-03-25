import type { MetadataRoute } from 'next';

import { APP_URL } from '@/lib/config/client';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/faq', '/privacy'],
      disallow: ['/login', '/docs', '/auth', '/elections', '/join', '/admin', '/api'],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
