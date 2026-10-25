import {
  CircleCheck,
  Eye,
  LayoutDashboard,
  Link2,
  Lock,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import Link from 'next/link';

import { ElectionCard } from '@/components/elections/election-card';
import { FeatureCard } from '@/components/landing/feature-card';
import { HeroReadyProvider } from '@/components/landing/hero-ready-context';
import { HeroVoteScene } from '@/components/landing/hero-vote-scene';
import { PlatformStatsSection } from '@/components/landing/platform-stats-section';
import { StatItem } from '@/components/landing/stat-item';
import { VoteScene } from '@/components/three/vote-scene';
import { Button } from '@/components/ui/button';
import { serverApi } from '@/lib/api/server';
import { APP_NAME } from '@/lib/config/client';
import { getServerSession } from '@/lib/server-auth';
import type { Election, ElectionVoteStatus } from '@/types/election';

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
    title: 'Авторизація через KPI ID',
    description: 'Вхід за допомогою KPI ID гарантує, що голосує справжній студент.',
  },
  {
    icon: <UserCheck className="h-6 w-6" />,
    title: 'Анонімність',
    description: 'Cистема знає, що ви проголосували, але не знає ваш вибір.',
  },
  {
    icon: <LayoutDashboard className="h-6 w-6" />,
    title: 'Адмін-панель',
    description: 'Зручний інтерфейс для організаторів виборів з гнучкими налаштуваннями опитувань.',
  },
];

const infoLabels = [
  { value: '100%', label: 'Анонімність' },
  { value: 'RSA', label: 'Шифрування' },
  { value: '0', label: 'Знань про вибір' },
  { value: '24/7', label: 'Доступність' },
];

export default async function HomePage() {
  const session = await getServerSession();
  const { data: stats } = await serverApi.stats.get();

  let featuredElections: Election[] = [];
  if (session) {
    const { data } = await serverApi.elections.list();
    const priority: Record<ElectionVoteStatus, number> = {
      can_vote: 0,
      voted: 1,
      cannot_vote: 2,
    };

    const getPriority = (status?: ElectionVoteStatus): number =>
      status ? priority[status] : Number.MAX_SAFE_INTEGER;

    featuredElections = (data?.elections ?? [])
      .filter((e) => e.status === 'open' && !e.deletedAt)
      .sort((a, b) => getPriority(a.voteStatus) - getPriority(b.voteStatus))
      .slice(0, 3);
  }

  return (
    <>
      <HeroReadyProvider>
        <section className="relative overflow-hidden">
          <HeroVoteScene variant="hero" eager />

          <div
            className="pointer-events-none absolute inset-0 z-1"
            style={{
              background:
                'linear-gradient(105deg, rgba(8,18,38,0.6) 0%, rgba(8,18,38,0.32) 34%, rgba(8,18,38,0) 62%)',
            }}
          />

          <div className="relative z-10 container py-16 md:py-32">
            <div className="max-w-3xl">
              <h1 className="mb-6 font-display text-5xl leading-[1.05] font-bold text-white md:text-6xl lg:text-7xl">
                Голос кожного{' '}
                <span className="relative">
                  <span
                    className="relative z-10 bg-clip-text text-transparent"
                    style={{ backgroundImage: 'linear-gradient(90deg, #f07d00, #fbbf24)' }}
                  >
                    важливий
                  </span>
                  <span className="absolute right-0 -bottom-1 left-0 h-0.5 rounded-full bg-linear-to-r from-kpi-orange to-amber-400 opacity-60" />
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
                style={{ animationDelay: '320ms', willChange: 'transform, opacity' }}
              >
                {['RSA-2048', 'Анонімно', 'Верифіковано'].map((chip, i) => (
                  <div
                    key={chip}
                    className="animate-badge-pop flex items-center gap-1.5 rounded-full border border-white/10 bg-white/6 px-3 py-1"
                    style={{
                      animationDelay: `${400 + i * 80}ms`,
                      willChange: 'transform, opacity',
                    }}
                  >
                    <CircleCheck className="h-3 w-3 text-kpi-blue-light" />
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
                style={{ fill: 'var(--background)' }}
              />
            </svg>
          </div>
        </section>

        {stats && <PlatformStatsSection stats={stats} />}
      </HeroReadyProvider>

      {/* Features */}
      <section className="relative z-20 my-20 -mt-px bg-background">
        <div className="container">
          <h2 className="mb-8 text-center font-display text-4xl font-bold text-foreground">
            Чому {APP_NAME}?
          </h2>

          <div className="stagger-children grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feat) => (
              <FeatureCard key={feat.title} {...feat} />
            ))}
          </div>

          <p className="font-body mt-8 text-center text-xs text-muted-foreground">
            Використовуючи платформу, ви погоджуєтесь з{' '}
            <Link
              href="/privacy"
              className="underline underline-offset-2 transition-colors hover:text-kpi-navy"
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
              <h2 className="font-display text-3xl font-bold text-foreground">
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
      <section className="relative overflow-hidden bg-kpi-navy py-20 md:pb-25 2xl:pb-30">
        <VoteScene variant="ambient" />

        <div className="relative z-10 container">
          <div className="stagger-children grid grid-cols-2 gap-8 md:grid-cols-4">
            {infoLabels.map((stat) => (
              <StatItem key={stat.label} {...stat} />
            ))}
          </div>
        </div>

        {/* Bottom wave */}
        <div className="absolute right-0 bottom-0 left-0 z-10">
          <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M0 48C0 48 288 12 720 12C1152 12 1440 48 1440 48L0 48Z"
              style={{ fill: 'var(--background)' }}
            />
          </svg>
        </div>
      </section>
    </>
  );
}
