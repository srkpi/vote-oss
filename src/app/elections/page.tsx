import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ElectionsFilter } from '@/components/elections/elections-filter';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { getServerSession, serverFetch } from '@/lib/server-auth';
import type { Election } from '@/types/election';

export const metadata: Metadata = {
  title: 'Голосування',
  description: 'Список всіх доступних голосувань',
};

export default async function ElectionsPage() {
  const session = await getServerSession();
  const { data: elections, error } = await serverFetch<Election[]>('/api/elections');

  const open = (elections ?? []).filter((e) => e.status === 'open').length;
  const upcoming = (elections ?? []).filter((e) => e.status === 'upcoming').length;
  const closed = (elections ?? []).filter((e) => e.status === 'closed').length;

  return (
    <div className="min-h-[calc(100vh-var(--header-height))] bg-[var(--surface)]">
      {/* Page header */}
      <div className="bg-white border-b border-[var(--border-subtle)]">
        <div className="container py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold text-[var(--foreground)] leading-tight">
                Голосування
              </h1>
              <p className="text-[var(--muted-foreground)] font-body mt-1">
                Всі доступні вам голосування в одному місці
              </p>
            </div>

            {session?.isAdmin && (
              <Button variant="accent" size="sm" asChild>
                <Link href="/admin/elections/new" className="inline-flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span className="inline">Нове голосування</span>
                </Link>
              </Button>
            )}
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
