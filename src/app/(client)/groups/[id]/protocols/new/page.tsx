import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { ProtocolFormClient } from '@/components/protocols/protocol-form-client';
import { serverApi } from '@/lib/api/server';
import { getServerSession } from '@/lib/server-auth';

export const metadata: Metadata = {
  title: 'Новий протокол',
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function NewProtocolPage({ params }: Props) {
  const session = await getServerSession();
  if (!session) redirect('/login');

  const { id } = await params;
  const { data: group, status } = await serverApi.groups.get(id);
  if (status === 404 || !group) notFound();
  if (group.ownerId !== session.userId) notFound();

  const year = new Date().getFullYear();
  const nextRes = await serverApi.groups.protocols.listWithNextNumber(id, year);
  const initialNextNumber = nextRes.success ? nextRes.data.nextNumber : null;

  return (
    <div className="bg-surface min-h-[calc(100dvh-var(--header-height))]">
      <ProtocolFormClient
        group={group}
        initialProtocol={null}
        canEdit
        initialNextNumber={initialNextNumber}
      />
    </div>
  );
}
