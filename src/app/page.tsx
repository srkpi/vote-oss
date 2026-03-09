import Link from 'next/link';
import {
  ChevronRight,
  Lock,
  Link2,
  Eye,
  ShieldCheck,
  UserCheck,
  LayoutDashboard,
} from 'lucide-react';
import { getServerSession } from '@/lib/server-auth';
import { serverFetch } from '@/lib/server-auth';
import { Button } from '@/components/ui/button';
import { ElectionCard } from '@/components/elections/election-card';
import type { Election } from '@/types';

export default async function HomePage() {
  const session = await getServerSession();

  let featuredElections: Election[] = [];
  if (session) {
    const { data } = await serverFetch<Election[]>('/api/elections');
    featuredElections = (data || []).filter((e) => e.status === 'open').slice(0, 3);
  }

  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 navy-gradient-subtle" />
        <div className="absolute inset-0 pattern-grid opacity-10" />

        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[var(--kpi-blue-light)]/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-[var(--kpi-orange)]/15 blur-3xl" />

        <div className="container relative py-24 md:py-32">
          <div className="max-w-3xl">
            {/* Pill badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/90 text-xs font-body uppercase tracking-widest mb-6 animate-fade-down">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--kpi-orange)] animate-pulse" />
              КПІ ім. Ігоря Сікорського
            </div>

            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.05] mb-6 animate-fade-up">
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

            <p
              className="font-body text-lg md:text-xl text-white/75 leading-relaxed mb-10 max-w-xl animate-fade-up"
              style={{ animationDelay: '100ms' }}
            >
              Безпечна, прозора та анонімна система електронного голосування для студентів і
              співробітників університету.
            </p>

            <div
              className="flex flex-wrap gap-4 animate-fade-up"
              style={{ animationDelay: '200ms' }}
            >
              {session ? (
                <Button variant="accent" size="xl" asChild>
                  <Link href="/elections">
                    Переглянути голосування
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button variant="accent" size="xl" asChild>
                    <Link href="/auth/login">
                      Увійти через КПІ ID
                      <ChevronRight className="w-5 h-5 ml-1" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="xl"
                    className="text-white border-white/40 hover:border-white hover:bg-white hover:text-[var(--kpi-navy)]"
                    asChild
                  >
                    <Link href="/elections">Переглянути виборчий список</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M0 48L1440 48L1440 0C1440 0 1152 36 720 36C288 36 0 0 0 0L0 48Z"
              fill="white"
            />
          </svg>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="container">
          <div className="text-center mb-14 animate-fade-up">
            <h2 className="font-display text-4xl font-bold text-[var(--foreground)] mb-3">
              Чому КПІ Голос?
            </h2>
            <p className="text-[var(--muted-foreground)] font-body max-w-lg mx-auto">
              Сучасні технології шифрування та блокчейн забезпечують чесність кожного голосування
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
            {features.map((feat) => (
              <FeatureCard key={feat.title} {...feat} />
            ))}
          </div>
        </div>
      </section>

      {/* Active elections */}
      {session && featuredElections.length > 0 && (
        <section className="py-20 bg-[var(--surface)]">
          <div className="container">
            <div className="flex items-center justify-between mb-10 animate-fade-up">
              <div>
                <h2 className="font-display text-3xl font-bold text-[var(--foreground)]">
                  Активні голосування
                </h2>
                <p className="text-[var(--muted-foreground)] font-body mt-1">
                  Доступні зараз для вашого факультету
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

      {/* Stats */}
      <section className="py-20 bg-[var(--kpi-navy)]">
        <div className="container">
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

const features = [
  {
    icon: <Lock className="w-6 h-6" />,
    title: 'RSA-шифрування',
    description:
      "Кожен бюлетень зашифровано ключем виборів. Ніхто не може пов'язати голос із виборцем.",
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
    description:
      'Нульові знання: система знає, що ви проголосували, але не може прочитати ваш вибір.',
  },
  {
    icon: <LayoutDashboard className="w-6 h-6" />,
    title: 'Адмін-панель',
    description: 'Зручний інтерфейс для організаторів виборів з гнучкими налаштуваннями доступу.',
  },
];

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-[var(--radius-xl)] bg-white border border-[var(--border-subtle)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all duration-300 group">
      <div className="w-12 h-12 rounded-xl navy-gradient flex items-center justify-center text-white mb-4 group-hover:scale-105 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="font-display text-lg font-semibold text-[var(--foreground)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--muted-foreground)] font-body leading-relaxed">
        {description}
      </p>
    </div>
  );
}

const stats = [
  { value: '100%', label: 'Анонімність' },
  { value: 'RSA-2048', label: 'Шифрування' },
  { value: '0', label: 'Знань про вибір' },
  { value: '24/7', label: 'Доступність' },
];

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-4xl font-bold text-white mb-2">{value}</div>
      <div className="text-sm text-white/60 font-body uppercase tracking-wider">{label}</div>
    </div>
  );
}
