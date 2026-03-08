import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from '@/lib/server-auth';
import { JoinAdminForm } from '@/components/admin/join-admin-form';

export const metadata: Metadata = {
  title: 'Приєднатися як адміністратор',
  description: 'Використайте токен запрошення, щоб отримати права адміністратора КПІ Голос.',
};

export default async function JoinPage() {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');

  // If already an admin, redirect to admin panel
  if (session.isAdmin) redirect('/admin');

  return (
    <div className="min-h-[calc(100vh-var(--header-height))] flex items-center justify-center p-6 bg-[var(--surface)]">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[var(--kpi-navy)]/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-[var(--kpi-orange)]/8 blur-3xl" />
        <div className="absolute inset-0 pattern-grid opacity-[0.03]" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Back link */}
        <Link
          href="/elections"
          className="inline-flex items-center gap-1.5 text-sm font-body text-[var(--muted-foreground)] hover:text-[var(--kpi-navy)] transition-colors mb-6 animate-fade-down"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Назад до голосувань
        </Link>

        {/* Main card */}
        <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--border-color)] shadow-[var(--shadow-xl)] overflow-hidden animate-fade-up">
          {/* Top accent bar */}
          <div className="h-1.5 w-full navy-gradient" />

          {/* Card header */}
          <div className="px-8 pt-8 pb-6 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl navy-gradient flex items-center justify-center shadow-[var(--shadow-md)]">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold text-[var(--foreground)] leading-tight">
                  Приєднатися як адміністратор
                </h1>
                <p className="text-sm font-body text-[var(--muted-foreground)] mt-0.5">
                  КПІ Голос · Система голосування
                </p>
              </div>
            </div>

            {/* User info banner */}
            <div className="flex items-center gap-3 p-3.5 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)]">
              <div className="w-9 h-9 rounded-full navy-gradient flex items-center justify-center text-white text-sm font-semibold shrink-0">
                {session.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold font-body text-[var(--foreground)] truncate">
                  {session.fullName}
                </p>
                <p className="text-xs font-body text-[var(--muted-foreground)]">
                  {session.faculty} · {session.group}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-body text-[var(--success)] bg-[var(--success-bg)] px-2 py-1 rounded-full border border-[var(--success)]/20 shrink-0">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Авторизовано
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="px-8 py-7">
            <JoinAdminForm />
          </div>

          {/* Footer */}
          <div className="px-8 pb-7 pt-0">
            <div className="pt-5 border-t border-[var(--border-subtle)]">
              <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] font-body">
                <svg
                  className="w-3.5 h-3.5 text-[var(--success)] shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Захищено · КПІ ім. Ігоря Сікорського · Токен перевіряється на сервері</span>
              </div>
            </div>
          </div>
        </div>

        {/* Info cards below */}
        <div
          className="mt-6 grid grid-cols-3 gap-3 animate-fade-up"
          style={{ animationDelay: '150ms', animationFillMode: 'both' }}
        >
          {[
            {
              icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
              ),
              title: 'Токен',
              desc: 'Одноразовий або обмежений за кількістю',
            },
            {
              icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              ),
              title: 'Термін дії',
              desc: 'Токен має обмежений час дії',
            },
            {
              icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              ),
              title: 'Права',
              desc: 'Визначаються адміністратором',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-4 text-center"
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--kpi-navy)]/10 text-[var(--kpi-navy)] flex items-center justify-center mx-auto mb-2">
                {item.icon}
              </div>
              <p className="text-xs font-semibold font-body text-[var(--foreground)]">
                {item.title}
              </p>
              <p className="text-[10px] font-body text-[var(--muted-foreground)] mt-0.5 leading-tight">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
