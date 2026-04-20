import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Активація токена доступу',
  description: 'Застосування обхідного токена для отримання доступу до голосування',
  robots: { index: false, follow: false },
};

export default function UseTokenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
