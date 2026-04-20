import type { Metadata } from 'next';

import { APP_NAME } from '@/lib/config/client';

export const metadata: Metadata = {
  title: 'API Документація',
  description: `Інтерактивна документація REST API платформи ${APP_NAME} у форматі OpenAPI / Swagger`,
  robots: { index: false, follow: false },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
