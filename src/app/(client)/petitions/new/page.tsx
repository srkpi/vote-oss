import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/common/page-header';
import { CreatePetitionForm } from '@/components/petitions/create-petition-form';
import { getServerSession } from '@/lib/server-auth';

export const metadata: Metadata = {
  title: 'Створити петицію',
  robots: { index: false, follow: false },
};

export default async function NewPetitionPage() {
  const session = await getServerSession();
  if (!session) redirect('/login');

  return (
    <div className="bg-surface min-h-[calc(100dvh-var(--header-height))]">
      <PageHeader
        nav={[{ label: 'Петиції', href: '/petitions' }, { label: 'Нова' }]}
        title="Нова петиція"
        description="Створіть петицію — після апруву адміністратором її побачать усі користувачі"
        isContainer
      />
      <div className="container py-8">
        <div className="border-border-color shadow-shadow-sm mx-auto max-w-2xl rounded-xl border bg-white p-6 sm:p-8">
          <CreatePetitionForm />
        </div>
      </div>
    </div>
  );
}
