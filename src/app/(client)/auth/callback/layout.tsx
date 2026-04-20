import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Авторизація у платформі',
  description: 'Верифікація токен авторизації через KPI ID',
  robots: { index: false, follow: false },
};

export default function AuthCallbackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
