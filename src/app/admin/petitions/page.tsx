import { Megaphone } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { AdminPetitionsClient } from '@/components/petitions/admin-petitions-client';
import { serverApi } from '@/lib/api/server';
import { getServerSession } from '@/lib/server-auth';

export const metadata: Metadata = {
  title: 'Петиції',
};

export default async function AdminPetitionsPage() {
  const session = await getServerSession();
  if (!session) redirect('/login');
  if (!session.managePetitions) redirect('/admin');

  const { data, error } = await serverApi.elections.list({ type: 'PETITION' });
  const petitions = data?.elections ?? [];

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        nav={[{ label: 'Адмін', href: '/admin' }, { label: 'Петиції' }]}
        title="Петиції"
        description="Апрув або видалення користувацьких петицій"
      />

      <div className="space-y-6 p-4 sm:p-8">
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
