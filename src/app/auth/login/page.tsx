import { CheckCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { KPIIDLogin } from '@/components/auth/kpi-id-login';

export const metadata: Metadata = {
  title: 'Вхід',
  description: 'Увійдіть за допомогою вашого КПІ ID',
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left panel - decorative */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 navy-gradient-subtle p-12 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-[var(--kpi-orange)]/10 translate-y-1/3 -translate-x-1/3" />
        <div className="absolute inset-0 pattern-grid opacity-10" />

        {/* Logo */}
        <Link className="relative flex items-center gap-3" href="/">
          <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
            <CheckCircle className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-display text-xl font-bold text-white leading-tight block">
              КПІ Голос
            </span>
            <span className="text-[10px] font-body text-white/50 uppercase tracking-widest">
              Система голосування
            </span>
          </div>
        </Link>

        {/* Main text */}
        <div className="relative">
          <h2 className="font-display text-4xl font-bold text-white leading-tight mb-4">
            Ваш голос — ваша{' '}
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(90deg, #f07d00, #fbbf24)' }}
            >
              відповідальність
            </span>
          </h2>
          <p className="font-body text-white/70 leading-relaxed">
            Використовуйте систему КПІ ID для безпечного та верифікованого входу до платформи
            голосування.
          </p>
        </div>

        {/* Security badges */}
        <div className="relative flex flex-wrap gap-3">
          {['RSA-2048', 'Анонімно'].map((badge) => (
            <div
              key={badge}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15"
            >
              <svg
                className="w-3.5 h-3.5 text-[var(--kpi-orange)]"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-xs font-body text-white/80">{badge}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm animate-fade-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-xl navy-gradient flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <span className="font-display text-xl font-bold text-[var(--kpi-navy)]">КПІ Голос</span>
          </div>

          {/* Title */}
          <div className="mb-10">
            <h1 className="font-display text-4xl font-bold text-[var(--foreground)] mb-2">
              Ласкаво просимо
            </h1>
            <p className="font-body text-[var(--muted-foreground)]">
              Увійдіть за допомогою вашого акаунту КПІ ID
            </p>
          </div>

          {/* KPI ID Button */}
          <div className="space-y-6">
            <div className="flex flex-col items-center">
              <KPIIDLogin appId="tests" />
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border-subtle)]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-[var(--muted-foreground)] font-body">
                  Авторизація через офіційний портал КПІ
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {[
                'Безпечна авторизація через КПІ ID',
                'Ваш голос анонімний та захищений',
                'Результати перевіряються публічно',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2.5 text-sm text-[var(--muted-foreground)] font-body"
                >
                  <svg
                    className="w-4 h-4 text-[var(--success)] shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <p className="mt-10 text-xs text-[var(--muted-foreground)] font-body text-center leading-relaxed">
            Використовуючи систему, ви погоджуєтесь з умовами використання КПІ ім. Ігоря
            Сікорського.
          </p>
        </div>
      </div>
    </div>
  );
}
