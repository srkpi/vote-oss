import { CheckCircle2, Clock, FileText, Megaphone, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { StatCard } from '@/components/admin/stat-card';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { AdminPetitionsClient } from '@/components/petitions/admin-petitions-client';
import { serverApi } from '@/lib/api/server';
import { getServerSession } from '@/lib/server-auth';
import { pluralize } from '@/lib/utils/common';

export const metadata: Metadata = {
  title: 'Петиції',
};

export default async function AdminPetitionsPage() {
  const session = await getServerSession();
  if (!session) redirect('/login');
  if (!session.managePetitions) redirect('/admin');

  const { data, error } = await serverApi.elections.list({ type: 'PETITION' });
  const petitions = data?.elections ?? [];

  const { activeCount, closedCount, pendingCount, totalSignatures } = petitions.reduce(
    (acc, p) => {
      if (p.deletedAt) return acc;
      if (!p.approved) acc.pendingCount++;
      else if (p.status === 'closed') acc.closedCount++;
      else acc.activeCount++;
      acc.totalSignatures += p.ballotCount ?? 0;
      return acc;
    },
    { activeCount: 0, closedCount: 0, pendingCount: 0, totalSignatures: 0 },
  );

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        nav={[{ label: 'Адмін', href: '/admin' }, { label: 'Петиції' }]}
        title="Петиції"
        description="Апрув або видалення користувацьких петицій"
      />

      <div className="space-y-6 p-4 sm:p-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="Активних"
            value={activeCount.toLocaleString('uk-UA')}
            accent="success"
            icon={<CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />}
          />
          <StatCard
            label="Завершених"
            value={closedCount.toLocaleString('uk-UA')}
            accent="navy"
            icon={<FileText className="h-4 w-4 sm:h-5 sm:w-5" />}
          />
          <StatCard
            label="Очікується"
            value={pendingCount.toLocaleString('uk-UA')}
            accent="orange"
            icon={<Clock className="h-4 w-4 sm:h-5 sm:w-5" />}
          />
          <StatCard
            label={pluralize(totalSignatures, ['Підпис', 'Підписи', 'Підписів'], false)}
            value={totalSignatures.toLocaleString('uk-UA')}
            accent="info"
            icon={<Users className="h-4 w-4 sm:h-5 sm:w-5" />}
          />
        </div>

        {error ? (
          <div className="border-border-color shadow-shadow-sm overflow-hidden rounded-xl border bg-white">
            <ErrorState title="Не вдалося завантажити петиції" description={error} />
          </div>
        ) : petitions.length === 0 ? (
          <div className="border-border-color shadow-shadow-sm overflow-hidden rounded-xl border bg-white">
            <EmptyState
              icon={<Megaphone className="h-10 w-10" />}
              title="Петицій поки немає"
              description="Створені користувачами петиції з'являться тут."
            />
          </div>
        ) : (
          <AdminPetitionsClient initialPetitions={petitions} />
        )}
      </div>
    </div>
  );
}
