import type { Metadata } from 'next';

import { isBotRequest } from '@/lib/utils/bot';

export const metadata: Metadata = {
  title: 'Приєднатись до групи',
  description: 'Застосування токена для приєднання до групи',
  robots: { index: false, follow: false },
};

export default async function UseTokenLayout({ children }: { children: React.ReactNode }) {
  if (await isBotRequest()) return null;

  return children;
}
