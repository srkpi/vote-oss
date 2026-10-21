import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { GroupDetailClient } from '@/components/groups/group-detail-client';
import { serverApi } from '@/lib/api/server';
import { APP_URL } from '@/lib/config/client';
import { getServerSession } from '@/lib/server-auth';
import { isBotRequest } from '@/lib/utils/bot';
import type { ElectionCampaign } from '@/types/campaign';
import type { CandidateRegistrationFormAdminSummary } from '@/types/candidate-registration';
import type { ProtocolSummary } from '@/types/protocol';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata | null> {
  const { id } = await params;
  const { data, success } = await serverApi.groups.get(id);
  if (!success) {
    return null;
  }

  return {
    title: data.name,
    description: 'Керування групою та членством в ній',
    openGraph: {
      title: data.name,
      description: 'Керування групою та членством в ній',
      url: new URL(`/groups/${id}`, APP_URL),
    },
    twitter: {
      card: 'summary_large_image',
      title: data.name,
      description: 'Керування групами та членством в них',
    },
  };
}

export default async function GroupDetailPage({ params }: Props) {
  if (await isBotRequest()) {
    return null;
  }

  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  const { id } = await params;
  const { data: group, status } = await serverApi.groups.get(id);

  if (status === 404 || !group) {
    notFound();
  }

  // Mirror the gating in GroupDetailClient so we only fetch forms when the
  // panel will actually render.
  const isActiveMember = group.members.some((m) => m.userId === session.userId);
  const canManageRegistrationForms = group.type === 'VKSU' && isActiveMember;

  let registrationForms: CandidateRegistrationFormAdminSummary[] = [];
  let registrationFormsError: string | null = null;
  if (canManageRegistrationForms) {
    const formsResult = await serverApi.groups.registrationForms.list(id);
    if (formsResult.success) {
      registrationForms = formsResult.data;
    } else {
      registrationFormsError = formsResult.error;
    }
  }

  let protocols: ProtocolSummary[] = [];
  let protocolsError: string | null = null;
  const protocolsResult = await serverApi.groups.protocols.list(id);
  if (protocolsResult.success) {
    protocols = protocolsResult.data;
  } else {
    protocolsError = protocolsResult.error;
  }

  let campaigns: ElectionCampaign[] = [];
  let campaignsError: string | null = null;
  if (canManageRegistrationForms) {
    const campaignsResult = await serverApi.groups.campaigns.list(id);
    if (campaignsResult.success) {
      campaigns = campaignsResult.data;
    } else {
      campaignsError = campaignsResult.error;
    }
  }

  return (
    <div className="min-h-[calc(100dvh-var(--header-height))] bg-surface">
      <GroupDetailClient
        group={group}
        session={session}
        registrationForms={registrationForms}
        registrationFormsError={registrationFormsError}
        protocols={protocols}
        protocolsError={protocolsError}
        campaigns={campaigns}
        campaignsError={campaignsError}
      />
    </div>
  );
}
