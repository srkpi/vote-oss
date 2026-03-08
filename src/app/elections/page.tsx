import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession, serverFetch } from '@/lib/server-auth';
import { ElectionsFilter } from '@/components/elections/elections-filter';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/common/empty-state';
import type { Election } from '@/types';

export const metadata: Metadata = {
  title: 'Голосування',
  description: 'Список всіх доступних голосувань',
};

export default async function ElectionsPage() {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');

  const { data: elections, error } = await serverFetch<Election[]>('/api/elections');

  const open = (elections ?? []).filter((e) => e.status === 'open').length;
  const upcoming = (elections ?? []).filter((e) => e.status === 'upcoming').length;
  const closed = (elections ?? []).filter((e) => e.status === 'closed').length;

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      {/* Page header */}
      <div className="bg-white border-b border-[var(--border-subtle)]">
        <div className="container py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="animate-fade-up">
              <h1 className="font-display text-3xl font-bold text-[var(--foreground)] leading-tight">
                Голосування
              </h1>
              <p className="text-[var(--muted-foreground)] font-body mt-1">
                Всі доступні вам голосування в одному місці
              </p>
            </div>

            <div
              className="flex items-center gap-3 animate-fade-up"
              style={{ animationDelay: '100ms' }}
            >
              <div className="hidden sm:flex items-center gap-2">
                {open > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--success-bg)] border border-[var(--success)]/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" />
                    <span className="text-xs font-medium text-[var(--success)] font-body">
                      {open} активних
                    </span>
                  </div>
                )}
                {upcoming > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--warning-bg)] border border-[var(--kpi-orange)]/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--kpi-orange)]" />
                    <span className="text-xs font-medium text-[var(--kpi-orange)] font-body">
                      {upcoming} майбутніх
                    </span>
                  </div>
                )}
              </div>

              {session.isAdmin && (
                <Button
                  variant="accent"
                  size="sm"
                  asChild
                  icon={
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  }
                >
                  <Link href="/admin/elections/new">Нове голосування</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-8">
        {error ? (
          <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] overflow-hidden">
            <ErrorState title="Не вдалося завантажити голосування" description={error} />
          </div>
        ) : (
          <ElectionsFilter
            elections={elections ?? []}
            counts={{ open, upcoming, closed, total: (elections ?? []).length }}
          />
        )}
      </div>
    </div>
  );
}
