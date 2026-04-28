import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { TeamAcceptClient } from '@/components/registration/team-accept-client';
import { serverApi } from '@/lib/api/server';
import { getServerSession } from '@/lib/server-auth';
import { isBotRequest } from '@/lib/utils/bot';

export const metadata: Metadata = {
  title: 'Запрошення в команду',
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function TeamAcceptPage({ params }: PageProps) {
  if (await isBotRequest()) return null;

  const session = await getServerSession();
  const { token } = await params;
  if (!session) {
    redirect(`/login?returnTo=${encodeURIComponent(`/registration/team-accept/${token}`)}`);
  }

  const { data, error, status } = await serverApi.teamInvites.get(token);

  return (
    <div className="bg-surface min-h-[calc(100dvh-var(--header-height))]">
      <TeamAcceptClient
        token={token}
        currentUserId={session.userId}
        preview={data ?? null}
        loadError={status !== 200 ? error : null}
      />
    </div>
  );
}
