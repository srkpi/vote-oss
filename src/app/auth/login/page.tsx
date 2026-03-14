import { Check, CheckCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { KPIIDLogin } from '@/components/auth/kpi-id-login';
import { AnimatedGrid } from '@/components/common/animated-grid';

export const metadata: Metadata = {
  title: 'Вхід',
  description: 'Увійдіть за допомогою вашого КПІ ID',
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* ── Left panel — decorative / high-tech ── */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 navy-gradient-subtle p-12 relative overflow-hidden">
        {/* Animated grid canvas */}
        <AnimatedGrid variant="dark" cellSize={44} />

        {/* Atmospheric glow orbs */}
        <div
          className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full animate-glow-breathe"
          style={{
            background: 'radial-gradient(circle, rgba(0,138,207,0.25) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full animate-glow-breathe-orange"
          style={{
            background: 'radial-gradient(circle, rgba(240,125,0,0.18) 0%, transparent 70%)',
            animationDelay: '2s',
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0,138,207,0.08) 0%, transparent 60%)',
            animation: 'glow-breathe 9s ease-in-out infinite',
            animationDelay: '4s',
          }}
        />

        {/* Radar / sonar rings — centered in panel */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
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
            className="w-2 h-2 rounded-full bg-[var(--kpi-blue-light)] -translate-x-1/2 -translate-y-1/2 absolute top-0 left-0"
            style={{ boxShadow: '0 0 8px 2px rgba(0,138,207,0.6)' }}
          />
        </div>

        {/* Scanning beam */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute left-0 right-0 h-px animate-scan-down"
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
          className="absolute right-10 top-1/4 w-20 h-20 animate-float-slow"
          style={{ animationDuration: '8s', animationDelay: '1s' }}
        >
          <svg
            viewBox="0 0 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full opacity-20"
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
          className="absolute left-10 bottom-1/4 w-12 h-12 animate-float"
          style={{ animationDuration: '6s', animationDelay: '3s' }}
        >
          <svg
            viewBox="0 0 50 50"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full opacity-15"
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
        <div className="absolute top-8 left-8 opacity-30 animate-crosshair-blink">
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
          className="absolute bottom-8 right-8 opacity-30 animate-crosshair-blink"
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

        {/* ── Content ── */}

        {/* Logo */}
        <Link className="relative flex items-center gap-3 z-10" href="/">
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
        <div className="relative z-10">
          <h2 className="font-display text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
            Ваш голос — ваша{' '}
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(90deg, #f07d00, #fbbf24)' }}
            >
              відповідальність
            </span>
          </h2>
          <p className="font-body text-white/65 leading-relaxed text-md xl:text-xl">
            Використовуйте систему КПІ ID для безпечного та верифікованого входу до платформи
            голосування.
          </p>
        </div>

        {/* Security badges */}
        <div className="relative z-10 flex flex-wrap gap-3">
          {['RSA-2048', 'Анонімно', 'Верифіковано'].map((badge, i) => (
            <div
              key={badge}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/8 border border-white/12 animate-badge-pop"
              style={{ animationDelay: `${400 + i * 80}ms` }}
            >
              <svg
                className="w-3.5 h-3.5 text-[var(--kpi-blue-light)]"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-xs font-body text-white/75">{badge}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel — login form ── */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        {/* Subtle background for the form side on mobile */}
        <div className="absolute inset-0 lg:hidden overflow-hidden">
          <AnimatedGrid variant="light" cellSize={52} />
          <div className="absolute inset-0 bg-white/75" />
        </div>

        <div className="w-full max-w-sm relative z-10">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-xl navy-gradient flex items-center justify-center shadow-[var(--shadow-button)]">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <span className="font-display text-xl font-bold text-[var(--kpi-navy)]">КПІ Голос</span>
          </div>

          {/* Title */}
          <div className="mb-10">
            <h1 className="font-display text-4xl font-bold text-[var(--foreground)] mb-2">
              Ласкаво просимо
            </h1>
            <p className="font-body text-[var(--muted-foreground)] text-sm">
              Увійдіть за допомогою вашого акаунту КПІ ID
            </p>
          </div>

          {/* KPI ID Button */}
          <div className="space-y-6">
            <div className="flex flex-col items-center" style={{ animationDelay: '100ms' }}>
              <KPIIDLogin appId={process.env.KPI_APP_ID} />
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

            {/* Trust signals */}
            <div className="space-y-3">
              {[
                'Безпечна авторизація через КПІ ID',
                'Ваш голос анонімний та захищений',
                'Результати перевіряються публічно',
              ].map((item, i) => (
                <div
                  key={item}
                  className="flex items-center gap-2.5 text-sm text-[var(--muted-foreground)] font-body opacity-0 animate-fade-up"
                  style={{ animationDelay: `${200 + i * 80}ms` }}
                >
                  <Check color="var(--success)" className="w-4 h-4 shrink-0" />
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
