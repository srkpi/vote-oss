import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getServerSession, serverFetch } from '@/lib/server-auth';
import { AdminsPageClient } from '@/components/admin/admins-page-client';
import type { Admin } from '@/types/admin';

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
  const restrictedToFaculty = currentAdmin?.restricted_to_faculty ?? false;

  return (
    <div className="flex-1 overflow-auto">
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
        <AdminsPageClient
          initialAdmins={all}
          currentUser={session}
          canInvite={canInvite}
          canGrantManageAdmins={canGrantManageAdmins}
          restrictedToFaculty={restrictedToFaculty}
          error={error}
        />
      </div>
    </div>
  );
}
