import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { TokensPageClient } from '@/components/admin/tokens-page-client';
import { PageHeader } from '@/components/common/page-header';
import { getServerSession, serverFetch } from '@/lib/server-auth';
import type { InviteToken } from '@/types/admin';

export const metadata: Metadata = {
  title: 'Токени запрошення',
};

export default async function TokensPage() {
  const session = await getServerSession();
  if (!session) {
    redirect('/');
  }

  if (!session.manageAdmins) {
    redirect('/admin');
  }

  const { data: tokens, error } = await serverFetch<InviteToken[]>('/api/admins/invite');

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        nav={[{ label: 'Адмін', href: '/admin' }, { label: 'Токени запрошення' }]}
        title="Токени запрошення"
        description="Керування посиланнями для запрошення нових адміністраторів"
      >
        <div id="tokens-header-actions" />
      </PageHeader>

      <div className="p-4 sm:p-8 space-y-6">
        <TokensPageClient
          initialTokens={tokens ?? []}
          canGrantManageAdmins={session.manageAdmins}
          restrictedToFaculty={session.restrictedToFaculty}
          error={error}
        />
      </div>
    </div>
  );
}
