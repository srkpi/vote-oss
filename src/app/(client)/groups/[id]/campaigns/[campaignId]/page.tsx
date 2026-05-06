import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { CampaignDashboard } from '@/components/campaigns/campaign-dashboard';
import { serverApi } from '@/lib/api/server';
import { getServerSession } from '@/lib/server-auth';
import type {
  CampaignFinalElectionSummary,
  CampaignSignatureElectionSummary,
} from '@/types/campaign';
import type { CandidateRegistrationFormAdminSummary } from '@/types/candidate-registration';

export const metadata: Metadata = {
  title: 'Виборча кампанія',
};

interface Props {
  params: Promise<{ id: string; campaignId: string }>;
}

export default async function CampaignDashboardPage({ params }: Props) {
  const session = await getServerSession();
  if (!session) redirect('/login');

  const { id, campaignId } = await params;

  const [groupRes, campaignRes] = await Promise.all([
    serverApi.groups.get(id),
    serverApi.campaigns.get(campaignId),
  ]);

  if (!groupRes.success || !groupRes.data) notFound();
  if (!campaignRes.success || !campaignRes.data) notFound();
  if (campaignRes.data.groupId !== id) notFound();

  // Dashboard mirrors the panel's gate: VKSU-typed group + active member.
  const group = groupRes.data;
  const isActiveMember = group.members.some((m) => m.userId === session.userId);
  const canViewDashboard = group.type === 'VKSU' && isActiveMember;
  if (!canViewDashboard) notFound();

  let registrationForm: CandidateRegistrationFormAdminSummary | null = null;
  if (campaignRes.data.registrationFormId) {
    const formsRes = await serverApi.groups.registrationForms.list(id);
    if (formsRes.success) {
      registrationForm =
        formsRes.data.find((f) => f.id === campaignRes.data.registrationFormId) ?? null;
    }
  }

  let signatureElections: CampaignSignatureElectionSummary[] = [];
  if (campaignRes.data.signatureCollection) {
    const sigRes = await serverApi.campaigns.signatureElections(campaignId);
    if (sigRes.success) signatureElections = sigRes.data;
  }

  let finalElection: CampaignFinalElectionSummary | null = null;
  if (campaignRes.data.finalElectionId) {
    const finalRes = await serverApi.campaigns.finalElection(campaignId);
    if (finalRes.success) finalElection = finalRes.data;
  }

  return (
    <div className="bg-surface min-h-[calc(100dvh-var(--header-height))]">
      <CampaignDashboard
        group={group}
        campaign={campaignRes.data}
        registrationForm={registrationForm}
        signatureElections={signatureElections}
        finalElection={finalElection}
      />
    </div>
  );
}
