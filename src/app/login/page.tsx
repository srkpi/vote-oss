import { CheckCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { KpiIdButton } from '@/components/auth/kpi-id-button';
import { VoteScene } from '@/components/three/vote-scene';
import { APP_NAME, APP_URL } from '@/lib/config/client';
import { OPENGRAPH_IMAGE_DATA } from '@/lib/utils/metadata';

export const metadata: Metadata = {
  title: 'Вхід',
  description: 'Увійдіть за допомогою KPI ID',
  openGraph: {
    title: `Вхід | ${APP_NAME}`,
    description: 'Увійдіть за допомогою KPI ID',
    url: new URL('/login', APP_URL),
    images: [OPENGRAPH_IMAGE_DATA],
  },
  twitter: {
    card: 'summary_large_image',
    title: `Вхід | ${APP_NAME}`,
    description: 'Увійдіть за допомогою KPI ID',
    images: [OPENGRAPH_IMAGE_DATA],
  },
};

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 lg:flex">
        <VoteScene variant="aside" eager />

        {/* Protective scrim: darkest where the brand lockup and headline sit
            (top and bottom of this justify-between column), open through the
            middle so the mark and chain network stay the visual focus. */}
        <div
          className="pointer-events-none absolute inset-0 z-1"
          style={{
            background:
              'linear-gradient(180deg, rgba(8,18,38,0.55) 0%, rgba(8,18,38,0.1) 24%, rgba(8,18,38,0) 46%, rgba(8,18,38,0) 60%, rgba(8,18,38,0.65) 100%)',
          }}
        />

        <Link className="relative z-10 flex items-center gap-3" href="/">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/15 backdrop-blur-sm">
            <CheckCircle className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col justify-center">
            <span className="font-display text-lg leading-tight font-semibold text-white">
              {APP_NAME}
            </span>
            <span className="font-body text-[10px] tracking-widest text-white/50 uppercase">
              Система голосування
            </span>
          </div>
        </Link>

        <div className="relative z-10">
          <h2 className="font-display mb-4 text-4xl leading-tight font-bold text-white xl:text-5xl">
            Ваш голос — ваша{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(90deg, #f07d00, #fbbf24)' }}
            >
              відповідальність
            </span>
          </h2>
          <p className="font-body text-md leading-relaxed text-white/65 xl:text-xl">
            Використовуйте KPI ID з верифікацією через Дію або BankID для верифікованого та
            безпечного входу до платформи
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap gap-3">
          {['RSA-2048', 'Анонімно', 'Верифіковано'].map((badge, i) => (
            <div
              key={badge}
              className="animate-badge-pop flex items-center gap-1.5 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 backdrop-blur-sm"
              style={{ animationDelay: `${400 + i * 80}ms`, willChange: 'transform, opacity' }}
            >
              <svg
                className="text-kpi-blue-light h-3.5 w-3.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-body text-xs text-white/75">{badge}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center p-8">
        <div className="absolute inset-0 overflow-hidden lg:hidden">
          <VoteScene variant="ambient" eager />
          <div className="absolute inset-0 bg-white/85" />
        </div>

        <div className="relative z-10 w-full max-w-sm">
          <div className="flex items-center justify-center">
            <Link className="mb-8 flex items-center gap-3 lg:hidden" href="/">
              <Image src="/logo.svg" alt="Logo" height={36} width={36} preload />
              <span className="font-display text-kpi-navy text-2xl font-bold">{APP_NAME}</span>
            </Link>
          </div>

          <h1 className="font-display text-foreground mb-8 text-center text-3xl font-bold sm:text-4xl">
            Ласкаво просимо
          </h1>

          <div className="space-y-6">
            <KpiIdButton fullWidth />

            <p className="font-body text-muted-foreground text-center text-xs">
              Натисканням на кнопку ви погоджуєтесь з{' '}
              <Link
                href="/privacy"
                className="hover:text-kpi-navy underline underline-offset-2 transition-colors"
              >
                Політикою конфіденційності
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
