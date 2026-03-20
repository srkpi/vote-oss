import { Check, CheckCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { KpiIdLogin } from '@/components/auth/kpi-id-login';
import { AnimatedGrid } from '@/components/common/animated-grid';
import { APP_NAME } from '@/lib/config/client';

export const metadata: Metadata = {
  title: 'Вхід',
  description: 'Увійдіть за допомогою KPI ID',
};

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh">
      <div className="navy-gradient-subtle relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 lg:flex">
        <AnimatedGrid variant="dark" cellSize={44} />

        {/* Atmospheric glow orbs */}
        <div
          className="animate-glow-breathe absolute -top-32 -right-32 h-112 w-md rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0,138,207,0.25) 0%, transparent 70%)',
          }}
        />
        <div
          className="animate-glow-breathe-orange absolute -bottom-24 -left-24 h-80 w-80 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(240,125,0,0.18) 0%, transparent 70%)',
            animationDelay: '2s',
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0,138,207,0.08) 0%, transparent 60%)',
            animation: 'glow-breathe 9s ease-in-out infinite',
            animationDelay: '4s',
          }}
        />

        {/* Radar / sonar rings — centered in panel */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="absolute rounded-full border border-white/10"
              style={{
                width: `${(i + 1) * 80}px`,
                height: `${(i + 1) * 80}px`,
                top: `${-((i + 1) * 40)}px`,
                left: `${-((i + 1) * 40)}px`,
                animation: `ring-expand 4s ease-out infinite`,
                animationDelay: `${i * 1}s`,
                animationFillMode: 'both',
              }}
            />
          ))}
          {/* Center dot */}
          <div
            className="bg-kpi-blue-light absolute top-0 left-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ boxShadow: '0 0 8px 2px rgba(0,138,207,0.6)' }}
          />
        </div>

        {/* Scanning beam */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="animate-scan-down absolute right-0 left-0 h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(0,138,207,0.4) 30%, rgba(0,138,207,0.7) 50%, rgba(0,138,207,0.4) 70%, transparent 100%)',
              top: '0',
              animationDuration: '7s',
              animationDelay: '1.5s',
            }}
          />
        </div>

        {/* Floating wireframe diamond */}
        <div
          className="animate-float-slow absolute top-1/4 right-10 h-20 w-20"
          style={{ animationDuration: '8s', animationDelay: '1s' }}
        >
          <svg
            viewBox="0 0 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full opacity-20"
          >
            <polygon
              points="40,2 78,40 40,78 2,40"
              stroke="rgba(0,138,207,1)"
              strokeWidth="1"
              fill="none"
            />
            <polygon
              points="40,14 66,40 40,66 14,40"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="0.5"
              fill="none"
            />
            <line x1="40" y1="2" x2="40" y2="78" stroke="rgba(0,138,207,0.3)" strokeWidth="0.5" />
            <line x1="2" y1="40" x2="78" y2="40" stroke="rgba(0,138,207,0.3)" strokeWidth="0.5" />
          </svg>
        </div>

        {/* Floating small hexagon */}
        <div
          className="animate-float absolute bottom-1/4 left-10 h-12 w-12"
          style={{ animationDuration: '6s', animationDelay: '3s' }}
        >
          <svg
            viewBox="0 0 50 50"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full opacity-15"
          >
            <polygon
              points="25,2 47,13.5 47,36.5 25,48 3,36.5 3,13.5"
              stroke="rgba(240,125,0,1)"
              strokeWidth="1"
              fill="none"
            />
            <polygon
              points="25,10 39,17.5 39,32.5 25,40 11,32.5 11,17.5"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="0.5"
              fill="none"
            />
          </svg>
        </div>

        {/* Corner crosshair TL */}
        <div className="animate-crosshair-blink absolute top-8 left-8 opacity-30">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <line x1="10" y1="0" x2="10" y2="7" stroke="rgba(0,138,207,1)" strokeWidth="1" />
            <line x1="10" y1="13" x2="10" y2="20" stroke="rgba(0,138,207,1)" strokeWidth="1" />
            <line x1="0" y1="10" x2="7" y2="10" stroke="rgba(0,138,207,1)" strokeWidth="1" />
            <line x1="13" y1="10" x2="20" y2="10" stroke="rgba(0,138,207,1)" strokeWidth="1" />
            <circle
              cx="10"
              cy="10"
              r="2"
              stroke="rgba(0,138,207,1)"
              strokeWidth="0.5"
              fill="none"
            />
          </svg>
        </div>
        {/* Corner crosshair BR */}
        <div
          className="animate-crosshair-blink absolute right-8 bottom-8 opacity-30"
          style={{ animationDelay: '1s' }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <line x1="10" y1="0" x2="10" y2="7" stroke="rgba(0,138,207,1)" strokeWidth="1" />
            <line x1="10" y1="13" x2="10" y2="20" stroke="rgba(0,138,207,1)" strokeWidth="1" />
            <line x1="0" y1="10" x2="7" y2="10" stroke="rgba(0,138,207,1)" strokeWidth="1" />
            <line x1="13" y1="10" x2="20" y2="10" stroke="rgba(0,138,207,1)" strokeWidth="1" />
            <circle
              cx="10"
              cy="10"
              r="2"
              stroke="rgba(0,138,207,1)"
              strokeWidth="0.5"
              fill="none"
            />
          </svg>
        </div>

        {/* Logo */}
        <Link className="relative z-10 flex items-center gap-3" href="/">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/15">
            <CheckCircle className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="font-display block text-xl leading-tight font-bold text-white">
              {APP_NAME}
            </span>
            <span className="font-body text-[10px] tracking-widest text-white/50 uppercase">
              Система голосування
            </span>
          </div>
        </Link>

        {/* Main text */}
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
            Використовуйте систему KPI ID для безпечного та верифікованого входу до платформи
            голосування
          </p>
        </div>

        {/* Security badges */}
        <div className="relative z-10 flex flex-wrap gap-3">
          {['RSA-2048', 'Анонімно', 'Верифіковано'].map((badge, i) => (
            <div
              key={badge}
              className="animate-badge-pop flex items-center gap-1.5 rounded-full border border-white/12 bg-white/8 px-3 py-1.5"
              style={{ animationDelay: `${400 + i * 80}ms` }}
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
        {/* Subtle background for the form side on mobile */}
        <div className="absolute inset-0 overflow-hidden lg:hidden">
          <AnimatedGrid variant="light" cellSize={52} />
          <div className="absolute inset-0 bg-white/75" />
        </div>

        <div className="relative z-10 w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center justify-center">
            <Link className="mb-8 flex items-center gap-3 lg:hidden" href="/">
              <div className="navy-gradient shadow-shadow-button flex h-9 w-9 items-center justify-center rounded-xl">
                <CheckCircle className="h-4 w-4 text-white" />
              </div>
              <span className="font-display text-kpi-navy text-2xl font-bold">{APP_NAME}</span>
            </Link>
          </div>

          <h1 className="font-display text-foreground mb-8 text-center text-3xl font-bold sm:text-4xl">
            Ласкаво просимо
          </h1>

          <div className="space-y-6">
            <KpiIdLogin fullWidth />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="border-border-subtle w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="font-body text-muted-foreground bg-white px-3">
                  Авторизація через офіційний портал КПІ
                </span>
              </div>
            </div>

            <div className="w-full space-y-3">
              {[
                'Голосують лише справжні студенти',
                'Твій голос анонімний та захищений',
                'Результати перевіряються публічно',
              ].map((item, i) => (
                <div
                  key={item}
                  className="font-body animate-fade-up text-muted-foreground flex items-center justify-center gap-2.5 text-sm opacity-0"
                  style={{ animationDelay: `${200 + i * 80}ms` }}
                >
                  <Check color="var(--success)" className="h-4 w-4 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
