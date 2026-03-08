import Link from 'next/link';
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
                    <svg
                      className="w-5 h-5 ml-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </Button>
              ) : (
                <>
                  <Button variant="accent" size="xl" asChild>
                    <Link href="/auth/login">
                      Увійти через КПІ ID
                      <svg
                        className="w-5 h-5 ml-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
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
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    ),
    title: 'RSA-шифрування',
    description:
      "Кожен бюлетень зашифровано ключем виборів. Ніхто не може пов'язати голос із виборцем.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
    ),
    title: 'Ланцюжок бюлетенів',
    description: "Кожен голос хешується та пов'язується з попереднім — фальсифікація неможлива.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </svg>
    ),
    title: 'Публічна перевірка',
    description: 'Будь-хто може перевірити свій бюлетень за хешем без розкриття змісту голосу.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
    title: 'Авторизація КПІ ID',
    description:
      'Вхід через офіційну систему ідентифікації КПІ гарантує, що голосує справжній студент.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2"
        />
      </svg>
    ),
    title: 'Анонімність',
    description:
      'Нульові знання: система знає, що ви проголосували, але не може прочитати ваш вибір.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 18h.01M8 21h8a2 2 0 002-2v-2M8 21a2 2 0 01-2-2v-2m12 0v-4a2 2 0 00-2-2h-1M8 17v-4a2 2 0 012-2h1m0 0V9a2 2 0 012-2h2a2 2 0 012 2v2m0 0h1M12 9h.01"
        />
      </svg>
    ),
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
