import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BypassPageClient } from '@/components/admin/bypass/bypass-page-client';
import { PageHeader } from '@/components/common/page-header';
import { serverApi } from '@/lib/api/server';
import { getServerSession } from '@/lib/server-auth';

export const metadata: Metadata = {
  title: 'Токени доступу',
};

export default async function BypassPage() {
  const session = await getServerSession();
  if (!session) redirect('/login');
  if (session.restrictedToFaculty) redirect('/admin');

  const { data: tokens, error } = await serverApi.bypass.listGlobal();

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        nav={[{ label: 'Адмін', href: '/admin' }, { label: 'Токени доступу' }]}
        title="Токени доступу"
        description="Видача обхідних токенів для студентів з проблемами доступу"
      />

      <div className="space-y-6 p-4 sm:p-8">
        <BypassPageClient initialTokens={tokens ?? []} error={error} />
      </div>
    </div>
  );
}
