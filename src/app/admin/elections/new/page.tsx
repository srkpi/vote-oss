import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { CreateElectionForm } from '@/components/admin/create-election-form';
import { PageHeader } from '@/components/common/page-header';
import { getServerSession } from '@/lib/server-auth';

export const metadata: Metadata = {
  title: 'Нове голосування',
};

export default async function NewElectionPage() {
  const session = await getServerSession();
  if (!session) {
    redirect('/auth/login');
  }

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
          <div className="rounded-xl border border-(--border-color) bg-white p-5 shadow-(--shadow-card) sm:p-8">
            <CreateElectionForm
              restrictedToFaculty={session.restrictedToFaculty ? session.faculty : null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
