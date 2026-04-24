import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AdminsPageClient } from '@/components/admin/admins-page-client';
import { PageHeader } from '@/components/common/page-header';
import { serverApi } from '@/lib/api/server';
import { getServerSession } from '@/lib/server-auth';

export const metadata: Metadata = {
  title: 'Адміністратори',
};

export default async function AdminsPage() {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  const { data, error } = await serverApi.admins.list();

  const all = data ?? [];
  const canInvite = session.manageAdmins ?? false;
  const canGrantManageAdmins = session.manageAdmins ?? false;
  const canGrantManageGroups = session.manageGroups ?? false;
  const canGrantManagePetitions = session.managePetitions ?? false;
  const canGrantManageFaq = session.manageFaq ?? false;
  const restrictedToFaculty = session.restrictedToFaculty ?? false;

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        nav={[{ label: 'Адмін', href: '/admin' }, { label: 'Адміністратори' }]}
        title="Адміністратори"
        description="Керування правами та запрошення нових адміністраторів"
      />

      <div className="space-y-6 p-4 sm:p-8">
        <AdminsPageClient
          initialAdmins={all}
          currentUser={session}
          canInvite={canInvite}
          canGrantManageAdmins={canGrantManageAdmins}
          canGrantManageGroups={canGrantManageGroups}
          canGrantManagePetitions={canGrantManagePetitions}
          canGrantManageFaq={canGrantManageFaq}
          restrictedToFaculty={restrictedToFaculty}
          error={error}
        />
      </div>
    </div>
  );
}
