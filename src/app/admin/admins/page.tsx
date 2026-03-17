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
    redirect('/auth/login');
  }

  const { data, error } = await serverApi.getAdmins();

  const all = data ?? [];
  const canInvite = session.manageAdmins ?? false;
  const canGrantManageAdmins = session.manageAdmins ?? false;
  const restrictedToFaculty = session.restrictedToFaculty ?? false;

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        nav={[{ label: 'Адмін', href: '/admin' }, { label: 'Адміністратори' }]}
        title="Адміністратори"
        description="Керування правами та запрошення нових адміністраторів"
      />

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
