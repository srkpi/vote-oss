import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AdminGroupsClient } from '@/components/admin/groups/admin-groups-client';
import { PageHeader } from '@/components/common/page-header';
import { serverApi } from '@/lib/api/server';
import { getServerSession } from '@/lib/server-auth';

export const metadata: Metadata = {
  title: 'Групи',
};

export default async function AdminGroupsPage() {
  const session = await getServerSession();
  if (!session) redirect('/login');
  if (!session.isAdmin || !session.manageGroups) redirect('/admin');

  const { data: groups, error } = await serverApi.groups.all();

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        nav={[{ label: 'Адмін', href: '/admin' }, { label: 'Групи' }]}
        title="Керування групами"
        description="Перегляд і модерація всіх груп у системі"
      />

      <div className="space-y-6 p-4 sm:p-8">
        <AdminGroupsClient initialGroups={groups ?? []} error={error} />
      </div>
    </div>
  );
}
