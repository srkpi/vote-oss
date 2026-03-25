import type { MetadataRoute } from 'next';

import { lastUpdated } from '@/app/(client)/privacy/page';
import { APP_URL } from '@/lib/config/client';

const [day, month, year] = lastUpdated.split('.').map(Number);
const privacyUpdateDate = new Date(year, month - 1, day);

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: APP_URL,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${APP_URL}/faq`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${APP_URL}/privacy`,
      lastModified: privacyUpdateDate,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
  ];
}
