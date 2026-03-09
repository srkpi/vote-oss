import type { Metadata } from 'next';
import Link from 'next/link';
import { serverFetch } from '@/lib/server-auth';
import { Button } from '@/components/ui/button';
import { AdminElectionsClient } from '@/components/admin/admin-elections-client';
import type { Election } from '@/types';

export const metadata: Metadata = {
  title: 'Голосування',
};

function StatCard({
  label,
  value,
  accent,
  icon,
  delay = 0,
}: {
  label: string;
  value: string | number;
  accent: 'navy' | 'orange' | 'success' | 'info';
  icon: React.ReactNode;
  delay?: number;
}) {
  const accentStyles = {
    navy: 'navy-gradient',
    orange: 'bg-[var(--kpi-orange)]',
    success: 'bg-[var(--success)]',
    info: 'bg-[var(--kpi-blue-light)]',
  };
  return (
    <div
      className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] p-4 sm:p-5 animate-fade-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <div
        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg ${accentStyles[accent]} flex items-center justify-center text-white shadow-[var(--shadow-sm)] mb-3`}
      >
        {icon}
      </div>
      <p className="font-display text-xl sm:text-2xl font-bold text-[var(--foreground)]">{value}</p>
      <p className="text-xs font-body text-[var(--muted-foreground)] mt-0.5">{label}</p>
    </div>
  );
}

export default async function AdminElectionsPage() {
  const { data: elections, error } = await serverFetch<Election[]>('/api/elections');

  const all = elections ?? [];
  const openCount = all.filter((e) => e.status === 'open').length;
  const upcomingCount = all.filter((e) => e.status === 'upcoming').length;
  const closedCount = all.filter((e) => e.status === 'closed').length;
  const totalBallots = all.reduce((sum, e) => sum + e.ballotCount, 0);

  return (
    <div className="flex-1 overflow-auto">
      {/* Page header */}
      <div className="bg-white border-b border-[var(--border-subtle)] px-4 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="animate-fade-up min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--foreground)]">
              Голосування
            </h1>
            <p className="font-body text-sm text-[var(--muted-foreground)] mt-0.5">
              Управління всіма голосуваннями в системі
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
            label="Активних зараз"
            value={openCount}
            accent="success"
            delay={0}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            label="Очікується"
            value={upcomingCount}
            accent="orange"
            delay={60}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
          <StatCard
            label="Завершених"
            value={closedCount}
            accent="navy"
            delay={120}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            label="Всього бюлетенів"
            value={totalBallots.toLocaleString('uk-UA')}
            accent="info"
            delay={180}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            }
          />
        </div>

        {/* Elections list */}
        <AdminElectionsClient elections={all} error={error} />
      </div>
    </div>
  );
}
