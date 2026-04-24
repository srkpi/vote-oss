import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { TokensPageClient } from '@/components/admin/invite/tokens-page-client';
import { PageHeader } from '@/components/common/page-header';
import { serverApi } from '@/lib/api/server';
import { getServerSession } from '@/lib/server-auth';

export const metadata: Metadata = {
  title: 'Токени запрошення',
};

export default async function TokensPage() {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  if (!session.manageAdmins) {
    redirect('/admin');
  }

  const { data: tokens, error } = await serverApi.admins.invites.list();

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        nav={[{ label: 'Адмін', href: '/admin' }, { label: 'Токени запрошення' }]}
        title="Токени запрошення"
        description="Керування посиланнями для запрошення нових адміністраторів"
      >
        <div id="tokens-header-actions" />
      </PageHeader>

      <div className="space-y-6 p-4 sm:p-8">
        <TokensPageClient
          initialTokens={tokens ?? []}
          canGrantManageAdmins={session.manageAdmins}
          canGrantManageGroups={session.manageGroups}
          canGrantManagePetitions={session.managePetitions ?? false}
          canGrantManageFaq={session.manageFaq ?? false}
          restrictedToFaculty={session.restrictedToFaculty}
          error={error}
        />
      </div>
    </div>
  );
}
