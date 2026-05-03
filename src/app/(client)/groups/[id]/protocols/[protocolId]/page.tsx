import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { ProtocolDocumentView } from '@/components/protocols/protocol-document-view';
import { ProtocolOwnerView } from '@/components/protocols/protocol-owner-view';
import { serverApi } from '@/lib/api/server';
import { getServerSession } from '@/lib/server-auth';

export const metadata: Metadata = {
  title: 'Протокол',
};

interface Props {
  params: Promise<{ id: string; protocolId: string }>;
}

export default async function ProtocolDetailPage({ params }: Props) {
  const session = await getServerSession();
  if (!session) redirect('/login');

  const { id, protocolId } = await params;
  const [groupRes, protocolRes] = await Promise.all([
    serverApi.groups.get(id),
    serverApi.protocols.get(protocolId),
  ]);

  if (!groupRes.success || !groupRes.data) notFound();
  if (!protocolRes.success || !protocolRes.data) notFound();
  if (protocolRes.data.groupId !== id) notFound();

  return (
    <div className="bg-surface min-h-[calc(100dvh-var(--header-height))]">
      {protocolRes.data.isOwner ? (
        <ProtocolOwnerView group={groupRes.data} protocol={protocolRes.data} />
      ) : (
        <ProtocolDocumentView group={groupRes.data} protocol={protocolRes.data} />
      )}
    </div>
  );
}
