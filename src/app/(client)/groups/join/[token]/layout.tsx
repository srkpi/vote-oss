import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Приєднатись до групи',
  description: 'Застосування токена для приєднання до групи',
  robots: { index: false, follow: false },
};

export default function UseTokenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
