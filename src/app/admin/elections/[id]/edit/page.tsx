import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { PageHeader } from '@/components/common/page-header';
import { CreateElectionForm } from '@/components/elections/admin/create-election-form';
import { serverApi } from '@/lib/api/server';
import { getServerSession } from '@/lib/server-auth';

interface EditElectionPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: EditElectionPageProps): Promise<Metadata> {
  const { id } = await params;
  const { data } = await serverApi.elections.og(id);
  return { title: data?.title ? `${data.title} — Редагування` : 'Редагування голосування' };
}

export default async function EditElectionPage({ params }: EditElectionPageProps) {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  const { id } = await params;
  const { data: election, status } = await serverApi.elections.get(id);

  if (status === 404 || !election || election.type === 'PETITION') {
    notFound();
  }

  if (election.status !== 'upcoming' || election.deletedAt || !election.canEdit) {
    redirect(`/admin/elections/${id}`);
  }

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        nav={[
          { label: 'Адмін', href: '/admin' },
          { label: 'Голосування', href: '/admin/elections' },
          { label: election.title, href: `/admin/elections/${id}` },
          { label: 'Редагуваня' },
        ]}
        title="Редагувати голосування"
        description="Змініть параметри голосування до його початку"
      />

      <div className="p-4 sm:p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="border-border-color shadow-shadow-card rounded-xl border bg-white p-5 sm:p-8">
            <CreateElectionForm
              restrictedToFaculty={session.restrictedToFaculty ? session.faculty : null}
              manageGroups={session.manageGroups}
              mode="edit"
              electionId={id}
              initialData={election}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
