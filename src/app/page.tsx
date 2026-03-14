import { Eye, LayoutDashboard, Link2, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import Link from 'next/link';

import { AnimatedGrid } from '@/components/common/animated-grid';
import { ElectionCard } from '@/components/elections/election-card';
import { FeatureCard } from '@/components/landing/feature-card';
import { StatItem } from '@/components/landing/stat-item';
import { Button } from '@/components/ui/button';
import { getServerSession } from '@/lib/server-auth';
import { serverFetch } from '@/lib/server-auth';
import type { Election } from '@/types/election';

const features = [
  {
    icon: <Lock className="w-6 h-6" />,
    title: 'RSA-шифрування',
    description: "Кожен бюлетень зашифровано. Ніхто не може пов'язати голос із виборцем.",
  },
  {
    icon: <Link2 className="w-6 h-6" />,
    title: 'Ланцюжок бюлетенів',
    description: "Кожен голос хешується та пов'язується з попереднім — фальсифікація неможлива.",
  },
  {
    icon: <Eye className="w-6 h-6" />,
    title: 'Публічна перевірка',
    description: 'Будь-хто може перевірити свій бюлетень за хешем без розкриття змісту голосу.',
  },
  {
    icon: <ShieldCheck className="w-6 h-6" />,
    title: 'Авторизація КПІ ID',
    description:
      'Вхід через офіційну систему ідентифікації КПІ гарантує, що голосує справжній студент.',
  },
  {
    icon: <UserCheck className="w-6 h-6" />,
    title: 'Анонімність',
    description: 'Cистема знає, що ви проголосували, але не знає ваш вибір.',
  },
  {
    icon: <LayoutDashboard className="w-6 h-6" />,
    title: 'Адмін-панель',
    description: 'Зручний інтерфейс для організаторів виборів з гнучкими налаштуваннями доступу.',
  },
];

const stats = [
  { value: '100%', label: 'Анонімність' },
  { value: 'RSA', label: 'Шифрування' },
  { value: '0', label: 'Знань про вибір' },
  { value: '24/7', label: 'Доступність' },
];

export default async function HomePage() {
  const session = await getServerSession();

  let featuredElections: Election[] = [];
  if (session) {
    const { data } = await serverFetch<Election[]>('/api/elections');
    featuredElections = (data || []).filter((e) => e.status === 'open').slice(0, 3);
  }

  return (
    <>
      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 navy-gradient-subtle" />

        {/* Animated grid — replaces static pattern-grid */}
        <AnimatedGrid variant="dark" cellSize={48} />

        {/* Breathing glow orbs */}
        <div
          className="absolute -top-24 -right-24 w-[28rem] h-[28rem] rounded-full animate-glow-breathe pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(0,138,207,0.22) 0%, transparent 65%)',
          }}
        />
        <div
          className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full animate-glow-breathe-orange pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(240,125,0,0.16) 0%, transparent 65%)',
            animationDelay: '3s',
          }}
        />
        <div
          className="absolute top-1/3 right-1/3 w-64 h-64 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(0,80,127,0.15) 0%, transparent 60%)',
            animation: 'glow-breathe 10s ease-in-out infinite',
            animationDelay: '6s',
          }}
        />

        {/* Floating geometric accents */}
        <div
          className="absolute top-20 right-24 w-16 h-16 animate-float-slow pointer-events-none hidden lg:block"
          style={{ animationDuration: '9s', animationDelay: '1s' }}
        >
          <svg viewBox="0 0 64 64" fill="none" className="w-full h-full opacity-15">
            <polygon
              points="32,2 62,17 62,47 32,62 2,47 2,17"
              stroke="rgba(0,138,207,1)"
              strokeWidth="1"
              fill="none"
            />
            <polygon
              points="32,14 50,23.5 50,40.5 32,50 14,40.5 14,23.5"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="0.5"
              fill="none"
            />
          </svg>
        </div>

        <div
          className="absolute bottom-20 right-16 w-10 h-10 animate-rotate-slow pointer-events-none hidden lg:block"
          style={{ opacity: 0.12 }}
        >
          <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
            <rect
              x="2"
              y="2"
              width="36"
              height="36"
              stroke="rgba(240,125,0,1)"
              strokeWidth="1"
              fill="none"
              transform="rotate(45 20 20)"
            />
            <rect
              x="8"
              y="8"
              width="24"
              height="24"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="0.5"
              fill="none"
              transform="rotate(45 20 20)"
            />
          </svg>
        </div>

        {/* Scanning beam */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none hidden lg:block">
          <div
            className="absolute left-0 right-0 h-px animate-scan-down"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(0,138,207,0.3) 25%, rgba(0,138,207,0.5) 50%, rgba(0,138,207,0.3) 75%, transparent 100%)',
              top: '0',
              animationDuration: '9s',
            }}
          />
        </div>

        <div className="container relative z-10 py-16 md:py-32">
          <div className="max-w-3xl">
            {/* Pill badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/90 text-xs font-body uppercase tracking-widest mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--kpi-orange)] animate-pulse" />
              КПІ ім. Ігоря Сікорського
            </div>

            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.05] mb-6">
              Голос кожного{' '}
              <span className="relative">
                <span
                  className="relative z-10 text-transparent bg-clip-text"
                  style={{ backgroundImage: 'linear-gradient(90deg, #f07d00, #fbbf24)' }}
                >
                  важливий
                </span>
                <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-[var(--kpi-orange)] to-amber-400 rounded-full opacity-60" />
              </span>
            </h1>

            <p className="font-body text-lg md:text-xl text-white/75 leading-relaxed mb-10 max-w-xl">
              Безпечна, прозора та анонімна система електронного голосування для органів
              студентського самоврядування
            </p>

            {/* Live status + CTA */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {session ? (
                <Button variant="accent" size="xl" asChild>
                  <Link href="/elections">Переглянути голосування</Link>
                </Button>
              ) : (
                <Button variant="accent" size="xl" asChild>
                  <Link href="/auth/login">Увійти через КПІ ID</Link>
                </Button>
              )}
            </div>

            {/* Floating stat chips below CTA */}
            <div
              className="flex flex-wrap gap-3 mt-8 animate-fade-up"
              style={{ animationDelay: '320ms' }}
            >
              {['RSA-2048', 'Анонімно', 'Верифіковано'].map((chip, i) => (
                <div
                  key={chip}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/6 border border-white/10 animate-badge-pop"
                  style={{ animationDelay: `${400 + i * 80}ms` }}
                >
                  <svg
                    className="w-3 h-3 text-[var(--kpi-blue-light)]"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-xs font-body text-white/70">{chip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom wave */}
        <div className="absolute bottom-0 left-0 right-0 z-10 pb-[-1px]">
          <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M0 48L1440 48L1440 0C1440 0 1152 36 720 36C288 36 0 0 0 0L0 48Z"
              fill="white"
            />
          </svg>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 bg-white">
        <div className="container">
          <h2 className="font-display text-center text-4xl font-bold text-[var(--foreground)] mb-8">
            Чому КПІ Голос?
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
            {features.map((feat) => (
              <FeatureCard key={feat.title} {...feat} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Active elections ── */}
      {session && featuredElections.length > 0 && (
        <section className="py-20 bg-[var(--surface)]">
          <div className="container">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="font-display text-3xl font-bold text-[var(--foreground)]">
                  Активні голосування
                </h2>
                <p className="text-[var(--muted-foreground)] font-body mt-1">
                  Доступні зараз для вашого підрозділу
                </p>
              </div>
              <Button variant="secondary" asChild>
                <Link href="/elections">Усі голосування</Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredElections.map((election, index) => (
                <ElectionCard key={election.id} election={election} index={index} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Stats — dark with animated grid ── */}
      <section className="py-20 bg-[var(--kpi-navy)] relative overflow-hidden">
        {/* Animated grid for stats section too */}
        <AnimatedGrid variant="dark" cellSize={56} />

        {/* Breathing orbs */}
        <div
          className="absolute -top-16 right-0 w-64 h-64 rounded-full pointer-events-none animate-glow-breathe"
          style={{
            background: 'radial-gradient(circle, rgba(0,138,207,0.15) 0%, transparent 60%)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-48 h-48 rounded-full pointer-events-none animate-glow-breathe-orange"
          style={{
            background: 'radial-gradient(circle, rgba(240,125,0,0.10) 0%, transparent 60%)',
            animationDelay: '4s',
          }}
        />

        <div className="container relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 stagger-children">
            {stats.map((stat) => (
              <StatItem key={stat.label} {...stat} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
