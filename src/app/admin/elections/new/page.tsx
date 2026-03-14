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
    redirect('/');
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
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] p-5 sm:p-8">
            <CreateElectionForm
              restrictedToFaculty={session.restrictedToFaculty ? session.faculty : null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
