import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/common/page-header';
import { CreateElectionForm } from '@/components/elections/admin/create-election-form';
import { getServerSession } from '@/lib/server-auth';

export const metadata: Metadata = {
  title: 'Нове голосування',
};

interface NewElectionPageProps {
  searchParams: Promise<{ groupId?: string }>;
}

export default async function NewElectionPage({ searchParams }: NewElectionPageProps) {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  const { groupId } = await searchParams;

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        nav={[
          { label: 'Адмін', href: '/admin' },
          { label: 'Голосування', href: '/admin/elections' },
          { label: 'Нове' },
        ]}
        title="Нове голосування"
        description="Налаштуйте параметри та варіанти голосування"
      />

      <div className="p-4 sm:p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="border-border-color shadow-shadow-card rounded-xl border bg-white p-5 sm:p-8">
            <CreateElectionForm
              restrictedToFaculty={session.restrictedToFaculty ? session.faculty : null}
              manageGroups={session.manageGroups}
              initialGroupMembershipId={groupId ?? null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
