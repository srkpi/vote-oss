import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Users, ShieldCheck, Lock } from 'lucide-react';
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
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
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
            icon={<Users className="w-5 h-5" />}
            accent="navy"
            delay={0}
          />
          <StatCard
            label="З правом керування адмінами"
            value={withManageAdmins}
            icon={<ShieldCheck className="w-5 h-5" />}
            accent="info"
            delay={60}
          />
          <StatCard
            label="Обмежені до підрозділу"
            value={restricted}
            icon={<Lock className="w-5 h-5" />}
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
                <Users className="w-4 h-4 text-white" />
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
