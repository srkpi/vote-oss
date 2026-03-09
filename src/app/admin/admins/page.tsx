import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerSession, serverFetch } from '@/lib/server-auth';
import { AdminsPageClient } from '@/components/admin/admins-page-client';
import { Alert } from '@/components/ui/alert';
import type { Admin } from '@/types';
import { StatCard } from '@/components/admin/stat-card';

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
      <div className="bg-white border-b border-[var(--border-subtle)] px-4 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="animate-fade-up min-w-0">
            <nav className="flex items-center gap-2 text-sm font-body text-[var(--muted-foreground)] mb-2 sm:mb-3">
              <Link href="/admin" className="hover:text-[var(--kpi-navy)] transition-colors">
                Адмін
              </Link>
              <svg
                className="w-3.5 h-3.5 shrink-0"
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
              <span className="text-[var(--foreground)]">Адміністратори</span>
            </nav>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--foreground)]">
              Адміністратори
            </h1>
            <p className="font-body text-sm text-[var(--muted-foreground)] mt-0.5">
              Керування правами та запрошення нових адміністраторів
            </p>
          </div>

          <div
            className="animate-fade-up shrink-0"
            style={{ animationDelay: '100ms', animationFillMode: 'both' }}
            id="admins-header-actions"
          />
        </div>
      </div>

      <div className="p-4 sm:p-8 space-y-6">
        {/* Stats row */}
        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 animate-fade-up"
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

        {/* Main content card */}
        <div
          className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden animate-fade-up"
          style={{ animationDelay: '220ms', animationFillMode: 'both' }}
        >
          {/* Card header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--border-subtle)]">
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
              <h2 className="font-display text-base sm:text-lg font-semibold text-[var(--foreground)]">
                Список адміністраторів
              </h2>
            </div>
          </div>

          {/* Error state */}
          {error && (
            <div className="p-4 sm:p-6">
              <Alert variant="error" title="Помилка завантаження">
                {error}
              </Alert>
            </div>
          )}

          {/* Client component handles invite button + table + dialog */}
          {!error && session && (
            <div className="p-4 sm:p-6 space-y-5">
              <AdminsPageClient
                initialAdmins={all}
                currentUser={session}
                canInvite={canInvite}
                canGrantManageAdmins={canGrantManageAdmins}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
