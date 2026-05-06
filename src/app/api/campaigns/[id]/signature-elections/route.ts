import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { safeDecrypt } from '@/lib/elections-view';
import { Errors } from '@/lib/errors';
import { GroupForbiddenError, GroupNotFoundError, requireVKSUGroupMember } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';
import type { CampaignSignatureElectionSummary } from '@/types/campaign';

function computeStatus(
  opensAt: Date,
  closesAt: Date,
  now: Date,
): CampaignSignatureElectionSummary['status'] {
  if (now < opensAt) return 'upcoming';
  if (now >= closesAt) return 'closed';
  return 'open';
}

/**
 * @swagger
 * /api/campaigns/{id}/signature-elections:
 *   get:
 *     summary: List per-candidate signature elections spawned for a campaign
 *     description: >
 *       Returns one entry per APPROVED candidate that has a spawned signature
 *       election attached.  Caller must be an active member of the campaign's
 *       VKSU group.
 *     tags: [ElectionCampaigns]
 *     security:
 *       - cookieAuth: []
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid campaign id');

  const campaign = await prisma.electionCampaign.findUnique({
    where: { id },
    select: {
      id: true,
      group_id: true,
      signature_quorum: true,
      deleted_at: true,
      group: { select: { deleted_at: true } },
    },
  });
  if (!campaign || campaign.deleted_at || campaign.group.deleted_at) {
    return Errors.notFound('Campaign not found');
  }

  try {
    await requireVKSUGroupMember(campaign.group_id, auth.user.sub);
  } catch (err) {
    if (err instanceof GroupNotFoundError) return Errors.notFound(err.message);
    if (err instanceof GroupForbiddenError) return Errors.forbidden(err.message);
    throw err;
  }

  const elections = await prisma.election.findMany({
    where: { campaign_id: id, candidate_registration_id: { not: null } },
    select: {
      id: true,
      opens_at: true,
      closes_at: true,
      candidate_registration_id: true,
      candidate_registration: {
        select: { id: true, user_id: true, full_name: true },
      },
      _count: { select: { ballots: true } },
    },
    orderBy: { created_at: 'asc' },
  });

  const now = new Date();
  const quorum = campaign.signature_quorum ?? 0;

  const summaries: CampaignSignatureElectionSummary[] = elections
    .filter((e) => e.candidate_registration !== null)
    .map((e) => ({
      electionId: e.id,
      registrationId: e.candidate_registration!.id,
      candidateUserId: e.candidate_registration!.user_id,
      candidateFullName: safeDecrypt(e.candidate_registration!.full_name),
      opensAt: e.opens_at.toISOString(),
      closesAt: e.closes_at.toISOString(),
      ballotCount: e._count.ballots,
      quorum,
      quorumReached: quorum > 0 && e._count.ballots >= quorum,
      status: computeStatus(e.opens_at, e.closes_at, now),
    }));

  return NextResponse.json(summaries);
}
