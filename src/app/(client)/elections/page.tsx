import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { ElectionsFilter } from '@/components/elections/elections-filter';
import { Button } from '@/components/ui/button';
import { serverApi } from '@/lib/api/server';
import { getServerSession } from '@/lib/server-auth';

export const metadata: Metadata = {
  title: 'Голосування',
  description: 'Список всіх доступних голосувань',
};

export default async function ElectionsPage() {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  const { data: elections, error } = await serverApi.elections.list();

  const open = (elections ?? []).filter((e) => e.status === 'open').length;
  const upcoming = (elections ?? []).filter((e) => e.status === 'upcoming').length;
  const closed = (elections ?? []).filter((e) => e.status === 'closed').length;

  return (
    <div className="bg-surface min-h-[calc(100dvh-var(--header-height))]">
      <PageHeader
        title="Голосування"
        description="Усі доступні вам голосування в одному місці"
        isContainer
      >
        {session.isAdmin && (
          <Button variant="accent" size="sm" asChild>
            <Link href="/admin/elections/new" className="inline-flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Нове голосування</span>
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="container py-8">
        {error ? (
          <div className="border-border-color shadow-shadow-sm overflow-hidden rounded-xl border bg-white">
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
