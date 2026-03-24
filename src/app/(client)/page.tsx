import { Eye, LayoutDashboard, Link2, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import Link from 'next/link';

import { AnimatedGrid } from '@/components/common/animated-grid';
import { ElectionCard } from '@/components/elections/election-card';
import { FeatureCard } from '@/components/landing/feature-card';
import { StatItem } from '@/components/landing/stat-item';
import { Button } from '@/components/ui/button';
import { serverApi } from '@/lib/api/server';
import { APP_NAME } from '@/lib/config/client';
import { getServerSession } from '@/lib/server-auth';
import type { Election } from '@/types/election';

const features = [
  {
    icon: <Lock className="h-6 w-6" />,
    title: 'RSA-шифрування',
    description: "Кожен бюлетень зашифровано. Ніхто не може пов'язати голос із виборцем.",
  },
  {
    icon: <Link2 className="h-6 w-6" />,
    title: 'Ланцюжок бюлетенів',
    description: "Кожен голос хешується та пов'язується з попереднім — фальсифікація неможлива.",
  },
  {
    icon: <Eye className="h-6 w-6" />,
    title: 'Публічна перевірка',
    description: 'Будь-хто може перевірити свій бюлетень за хешем без розкриття змісту голосу.',
  },
  {
    icon: <ShieldCheck className="h-6 w-6" />,
    title: 'Авторизація KPI ID',
    description:
      'Вхід через офіційну систему ідентифікації КПІ гарантує, що голосує справжній студент.',
  },
  {
    icon: <UserCheck className="h-6 w-6" />,
    title: 'Анонімність',
    description: 'Cистема знає, що ви проголосували, але не знає ваш вибір.',
  },
  {
    icon: <LayoutDashboard className="h-6 w-6" />,
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
    const { data } = await serverApi.getElections();
    featuredElections = (data || []).filter((e) => e.status === 'open').slice(0, 3);
  }

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="navy-gradient-subtle absolute inset-0" />
        <AnimatedGrid variant="dark" cellSize={48} />

        {/* Breathing glow orbs */}
        <div
          className="animate-glow-breathe pointer-events-none absolute -top-24 -right-24 h-112 w-md rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0,138,207,0.22) 0%, transparent 65%)',
          }}
        />
        <div
          className="animate-glow-breathe-orange pointer-events-none absolute -bottom-16 -left-16 h-72 w-72 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(240,125,0,0.16) 0%, transparent 65%)',
            animationDelay: '3s',
          }}
        />
        <div
          className="pointer-events-none absolute top-1/3 right-1/3 h-64 w-64 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0,80,127,0.15) 0%, transparent 60%)',
            animation: 'glow-breathe 10s ease-in-out infinite',
            animationDelay: '6s',
          }}
        />

        {/* Floating geometric accents */}
        <div
          className="animate-float-slow pointer-events-none absolute top-20 right-24 hidden h-16 w-16 lg:block"
          style={{ animationDuration: '9s', animationDelay: '1s' }}
        >
          <svg viewBox="0 0 64 64" fill="none" className="h-full w-full opacity-15">
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
          className="animate-rotate-slow pointer-events-none absolute right-16 bottom-20 hidden h-10 w-10 lg:block"
          style={{ opacity: 0.12 }}
        >
          <svg viewBox="0 0 40 40" fill="none" className="h-full w-full">
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
        <div className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block">
          <div
            className="animate-scan-down absolute right-0 left-0 h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(0,138,207,0.3) 25%, rgba(0,138,207,0.5) 50%, rgba(0,138,207,0.3) 75%, transparent 100%)',
              top: '0',
              animationDuration: '9s',
            }}
          />
        </div>

        <div className="relative z-10 container py-16 md:py-32">
          <div className="max-w-3xl">
            <div className="font-body mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs tracking-widest text-white/90 uppercase">
              <span className="bg-kpi-orange h-1.5 w-1.5 animate-pulse rounded-full" />
              КПІ ім. Ігоря Сікорського
            </div>

            <h1 className="font-display mb-6 text-5xl leading-[1.05] font-bold text-white md:text-6xl lg:text-7xl">
              Голос кожного{' '}
              <span className="relative">
                <span
                  className="relative z-10 bg-clip-text text-transparent"
                  style={{ backgroundImage: 'linear-gradient(90deg, #f07d00, #fbbf24)' }}
                >
                  важливий
                </span>
                <span className="from-kpi-orange absolute right-0 -bottom-1 left-0 h-0.5 rounded-full bg-linear-to-r to-amber-400 opacity-60" />
              </span>
            </h1>

            <p className="font-body mb-10 max-w-xl text-lg leading-relaxed text-white/75 md:text-xl">
              Безпечна, прозора та анонімна система електронного голосування для органів
              студентського самоврядування
            </p>

            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              {session ? (
                <Button variant="accent" size="xl" asChild>
                  <Link href="/elections">Переглянути голосування</Link>
                </Button>
              ) : (
                <Button variant="accent" size="xl" asChild>
                  <Link href="/login">Увійти через KPI ID</Link>
                </Button>
              )}
            </div>

            <div
              className="animate-fade-up mt-8 flex flex-wrap gap-3"
              style={{ animationDelay: '320ms' }}
            >
              {['RSA-2048', 'Анонімно', 'Верифіковано'].map((chip, i) => (
                <div
                  key={chip}
                  className="animate-badge-pop flex items-center gap-1.5 rounded-full border border-white/10 bg-white/6 px-3 py-1"
                  style={{ animationDelay: `${400 + i * 80}ms` }}
                >
                  <svg
                    className="text-kpi-blue-light h-3 w-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="font-body text-xs text-white/70">{chip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom wave */}
        <div className="absolute right-0 bottom-0 left-0 z-10 pb-[-1px]">
          <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M0 48L1440 48L1440 0C1440 0 1152 36 720 36C288 36 0 0 0 0L0 48Z"
              fill="white"
            />
          </svg>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-20">
        <div className="container">
          <h2 className="font-display text-foreground mb-8 text-center text-4xl font-bold">
            Чому {APP_NAME}?
          </h2>

          <div className="stagger-children grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feat) => (
              <FeatureCard key={feat.title} {...feat} />
            ))}
          </div>

          <p className="font-body text-muted-foreground mt-8 text-center text-xs">
            Використовуючи платформу, ви погоджуєтесь з{' '}
            <Link
              href="/privacy"
              className="hover:text-kpi-navy underline underline-offset-2 transition-colors"
            >
              Політикою конфіденційності
            </Link>
          </p>
        </div>
      </section>

      {/* Active elections */}
      {session && featuredElections.length > 0 && (
        <section className="bg-surface py-20">
          <div className="container">
            <div className="mb-10 flex items-center justify-between">
              <h2 className="font-display text-foreground text-3xl font-bold">
                <span className="md:hidden">Голосування</span>
                <span className="hidden sm:inline">Активні голосування</span>
              </h2>
              <Button variant="secondary" asChild>
                <Link href="/elections">
                  <span className="md:hidden">Усі</span>
                  <span className="hidden sm:inline">Усі голосування</span>
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredElections.map((election, index) => (
                <ElectionCard key={election.id} election={election} index={index} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Stats */}
      <section className="bg-kpi-navy relative overflow-hidden py-20">
        <AnimatedGrid variant="dark" cellSize={56} />

        {/* Breathing orbs */}
        <div
          className="animate-glow-breathe pointer-events-none absolute -top-16 right-0 h-64 w-64 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0,138,207,0.15) 0%, transparent 60%)',
          }}
        />
        <div
          className="animate-glow-breathe-orange pointer-events-none absolute bottom-0 left-0 h-48 w-48 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(240,125,0,0.10) 0%, transparent 60%)',
            animationDelay: '4s',
          }}
        />

        <div className="relative z-10 container">
          <div className="stagger-children grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat) => (
              <StatItem key={stat.label} {...stat} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
