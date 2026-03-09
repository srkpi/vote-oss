import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerSession, serverFetch } from '@/lib/server-auth';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/utils';
import type { Election, Admin } from '@/types';
import { StatCard } from '@/components/admin/stat-card';

export const metadata: Metadata = {
  title: 'Огляд',
};

export default async function AdminDashboardPage() {
  const session = await getServerSession();

  const [electionsResult, adminsResult] = await Promise.all([
    serverFetch<Election[]>('/api/elections'),
    serverFetch<Admin[]>('/api/admins'),
  ]);

  const elections = electionsResult.data ?? [];
  const admins = adminsResult.data ?? [];

  const openElections = elections.filter((e) => e.status === 'open');
  const totalBallots = elections.reduce((sum, e) => sum + e.ballotCount, 0);

  const recentElections = [...elections]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="flex-1 overflow-auto">
      {/* Page header */}
      <div className="bg-white border-b border-[var(--border-subtle)] px-4 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="animate-fade-up min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--foreground)] truncate">
              Добрий день, {session?.fullName.split(' ')[1] ?? session?.fullName}!
            </h1>
            <p className="font-body text-sm text-[var(--muted-foreground)] mt-0.5">
              Ось короткий огляд системи голосування
            </p>
          </div>
          <div
            className="flex items-center gap-3 animate-fade-up shrink-0"
            style={{ animationDelay: '100ms' }}
          >
            <Button
              variant="accent"
              size="sm"
              asChild
              icon={
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              }
            >
              <Link href="/admin/elections/new">
                <span className="hidden sm:inline">Нове голосування</span>
                <span className="sm:hidden">Нове</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-8 space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Активних голосувань"
            value={openElections.length}
            accent="success"
            delay={0}
            icon={
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
          <StatCard
            label="Всього голосувань"
            value={elections.length}
            accent="navy"
            delay={60}
            icon={
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            }
          />
          <StatCard
            label="Подано бюлетенів"
            value={totalBallots.toLocaleString('uk-UA')}
            accent="orange"
            delay={120}
            icon={
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            }
          />
          <StatCard
            label="Адміністраторів"
            value={admins.length}
            accent="info"
            delay={180}
            icon={
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
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
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Recent elections */}
          <div
            className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden animate-fade-up"
            style={{ animationDelay: '250ms', animationFillMode: 'both' }}
          >
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--border-subtle)]">
              <h2 className="font-display text-base sm:text-lg font-semibold text-[var(--foreground)]">
                Нещодавні голосування
              </h2>
              <Link
                href="/admin/elections"
                className="text-xs font-body text-[var(--kpi-navy)] hover:underline shrink-0"
              >
                Переглянути всі →
              </Link>
            </div>

            {recentElections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] flex items-center justify-center mb-4">
                  <svg
                    className="w-7 h-7 text-[var(--kpi-gray-mid)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <p className="font-display text-base font-semibold text-[var(--foreground)]">
                  Голосувань поки немає
                </p>
                <p className="text-sm text-[var(--muted-foreground)] font-body mt-1 mb-4">
                  Створіть перше голосування для вашого факультету
                </p>
                <Button variant="accent" size="sm" asChild>
                  <Link href="/admin/elections/new">Створити голосування</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {recentElections.map((election) => {
                  const statusConfig = {
                    open: {
                      label: 'Активне',
                      dot: 'bg-[var(--success)]',
                      text: 'text-[var(--success)]',
                      bg: 'bg-[var(--success-bg)]',
                    },
                    upcoming: {
                      label: 'Очікується',
                      dot: 'bg-[var(--kpi-orange)]',
                      text: 'text-[var(--kpi-orange)]',
                      bg: 'bg-[var(--warning-bg)]',
                    },
                    closed: {
                      label: 'Завершено',
                      dot: 'bg-[var(--kpi-gray-light)]',
                      text: 'text-[var(--muted-foreground)]',
                      bg: 'bg-[var(--surface)]',
                    },
                  }[election.status];

                  return (
                    <Link
                      key={election.id}
                      href={`/elections/${election.id}`}
                      className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 hover:bg-[var(--surface)] transition-colors group"
                    >
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${statusConfig.dot} ${election.status === 'open' ? 'animate-pulse' : ''}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium font-body text-[var(--foreground)] truncate group-hover:text-[var(--kpi-navy)] transition-colors">
                          {election.title}
                        </p>
                        <p className="text-xs font-body text-[var(--muted-foreground)] mt-0.5 hidden sm:block">
                          {formatDateTime(election.opensAt)} — {formatDateTime(election.closesAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.text}`}
                        >
                          {statusConfig.label}
                        </span>
                        <span className="text-xs font-body text-[var(--muted-foreground)] hidden sm:inline">
                          {election.ballotCount} голосів
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
