import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerSession, serverFetch } from '@/lib/server-auth';
import { AdminsPageClient } from '@/components/admin/admins-page-client';
import { Alert } from '@/components/ui/alert';
import type { Admin } from '@/types';

export const metadata: Metadata = {
  title: 'Адміністратори',
};

export default async function AdminsPage() {
  const session = await getServerSession();

  const { data: admins, error } = await serverFetch<Admin[]>('/api/admins');

  const all = admins ?? [];
  const currentAdmin = all.find((a) => a.user_id === session?.userId);
  const canInvite = currentAdmin?.manage_admins ?? false;
  const canGrantManageAdmins = currentAdmin?.manage_admins ?? false;

  const withManageAdmins = all.filter((a) => a.manage_admins).length;
  const restricted = all.filter((a) => a.restricted_to_faculty).length;

  return (
    <div className="flex-1 overflow-auto">
      {/* Page header */}
      <div className="bg-white border-b border-[var(--border-subtle)] px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="animate-fade-up">
            <nav className="flex items-center gap-2 text-sm font-body text-[var(--muted-foreground)] mb-3">
              <Link href="/admin" className="hover:text-[var(--kpi-navy)] transition-colors">
                Адмін
              </Link>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              <span className="text-[var(--foreground)]">Адміністратори</span>
            </nav>
            <h1 className="font-display text-3xl font-bold text-[var(--foreground)]">
              Адміністратори
            </h1>
            <p className="font-body text-[var(--muted-foreground)] mt-0.5">
              Керування правами та запрошення нових адміністраторів
            </p>
          </div>

          {/* Invite button placeholder — rendered by client component */}
          <div
            className="animate-fade-up"
            style={{ animationDelay: '100ms', animationFillMode: 'both' }}
            id="admins-header-actions"
          />
        </div>
      </div>

      <div className="p-8 space-y-6">
        {/* Stats row */}
        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-up"
          style={{ animationFillMode: 'both' }}
        >
          <StatCard
            label="Всього адміністраторів"
            value={all.length}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            }
            accent="navy"
            delay={0}
          />
          <StatCard
            label="З правом керування адмінами"
            value={withManageAdmins}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            }
            accent="info"
            delay={60}
          />
          <StatCard
            label="Обмежені (по факультету)"
            value={restricted}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            }
            accent="orange"
            delay={120}
          />
        </div>

        {/* How to join info card (if user can invite) */}
        {canInvite && (
          <div
            className="flex items-start gap-4 p-5 rounded-[var(--radius-xl)] navy-gradient text-white animate-fade-up"
            style={{ animationDelay: '180ms', animationFillMode: 'both' }}
          >
            <div className="w-10 h-10 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-base font-semibold leading-tight">
                Запрошення адміністраторів
              </p>
              <p className="text-sm text-white/80 font-body mt-1 leading-relaxed">
                Натисніть «Запросити адміна», щоб створити одноразовий токен. Передайте його
                потрібній людині — вона зможе приєднатися через сторінку{' '}
                <Link
                  href="/join"
                  className="underline underline-offset-2 hover:text-white transition-colors"
                >
                  /join
                </Link>
                .
              </p>
            </div>
          </div>
        )}

        {/* Main content card */}
        <div
          className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden animate-fade-up"
          style={{ animationDelay: '220ms', animationFillMode: 'both' }}
        >
          {/* Card header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg navy-gradient flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
                Список адміністраторів
              </h2>
            </div>
          </div>

          {/* Error state */}
          {error && (
            <div className="p-6">
              <Alert variant="error" title="Помилка завантаження">
                {error}
              </Alert>
            </div>
          )}

          {/* Client component handles invite button + table + dialog */}
          {!error && session && (
            <div className="p-6 space-y-5">
              <AdminsPageClient
                initialAdmins={all}
                currentUser={session}
                canInvite={canInvite}
                canGrantManageAdmins={canGrantManageAdmins}
              />
            </div>
          )}
        </div>

        {/* Hierarchy explanation */}
        <div
          className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] p-6 animate-fade-up"
          style={{ animationDelay: '280ms', animationFillMode: 'both' }}
        >
          <h3 className="font-display text-base font-semibold text-[var(--foreground)] mb-4">
            Ієрархія прав
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                title: 'Базові права',
                description:
                  'Може створювати та переглядати голосування. Обмежений своїм факультетом, якщо встановлено обмеження.',
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ),
                color: 'text-[var(--success)] bg-[var(--success-bg)] border-[var(--success)]/20',
              },
              {
                title: 'Керування адмінами',
                description:
                  'Може запрошувати нових адміністраторів та видаляти тих, кого сам призначив.',
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                    />
                  </svg>
                ),
                color:
                  'text-[var(--kpi-blue-light)] bg-[var(--info-bg)] border-[var(--kpi-blue-light)]/20',
              },
              {
                title: 'Обмежений адмін',
                description:
                  'Може керувати лише голосуваннями свого факультету. Не може знімати обмеження при запрошенні.',
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                ),
                color:
                  'text-[var(--kpi-orange)] bg-[var(--warning-bg)] border-[var(--kpi-orange)]/20',
              },
            ].map((item) => (
              <div
                key={item.title}
                className={`p-4 rounded-[var(--radius-lg)] border ${item.color}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {item.icon}
                  <span className="font-body text-sm font-semibold">{item.title}</span>
                </div>
                <p className="text-xs font-body leading-relaxed opacity-80">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
  delay,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: 'navy' | 'orange' | 'info';
  delay: number;
}) {
  const accentStyles = {
    navy: 'navy-gradient',
    orange: 'bg-[var(--kpi-orange)]',
    info: 'bg-[var(--kpi-blue-light)]',
  };

  return (
    <div
      className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] p-5 animate-fade-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <div
        className={`w-10 h-10 rounded-lg ${accentStyles[accent]} flex items-center justify-center text-white shadow-[var(--shadow-sm)] mb-4`}
      >
        {icon}
      </div>
      <p className="font-display text-3xl font-bold text-[var(--foreground)]">{value}</p>
      <p className="text-xs font-body text-[var(--muted-foreground)] mt-1">{label}</p>
    </div>
  );
}
