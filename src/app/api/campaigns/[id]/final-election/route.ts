import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { safeDecrypt } from '@/lib/elections-view';
import { Errors } from '@/lib/errors';
import { GroupForbiddenError, GroupNotFoundError, requireVKSUGroupMember } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';
import type { CampaignFinalElectionSummary } from '@/types/campaign';

function computeStatus(
  opensAt: Date,
  closesAt: Date,
  now: Date,
): CampaignFinalElectionSummary['status'] {
  if (now < opensAt) return 'upcoming';
  if (now >= closesAt) return 'closed';
  return 'open';
}

/**
 * @swagger
 * /api/campaigns/{id}/final-election:
 *   get:
 *     summary: Get the campaign's final Election summary
 *     description: >
 *       Returns the spawned final election with one choice per qualifying
 *       candidate.  Caller must be an active member of the campaign's VKSU
 *       group.  Responds with 404 when the final election hasn't been
 *       created yet (e.g., campaign is still pre-voting).
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
      final_election_id: true,
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

  if (!campaign.final_election_id) {
    return NextResponse.json(null);
  }

  const election = await prisma.election.findUnique({
    where: { id: campaign.final_election_id },
    select: {
      id: true,
      opens_at: true,
      closes_at: true,
      _count: { select: { ballots: true } },
      choices: {
        orderBy: { position: 'asc' },
        select: {
          choice: true,
          position: true,
          vote_count: true,
          candidate_registration_id: true,
          candidate_registration: { select: { full_name: true } },
        },
      },
    },
  });
  if (!election) return NextResponse.json(null);

  const summary: CampaignFinalElectionSummary = {
    electionId: election.id,
    status: computeStatus(election.opens_at, election.closes_at, new Date()),
    opensAt: election.opens_at.toISOString(),
    closesAt: election.closes_at.toISOString(),
    ballotCount: election._count.ballots,
    choices: election.choices.map((c) => ({
      candidateRegistrationId: c.candidate_registration_id,
      candidateFullName: c.candidate_registration
        ? safeDecrypt(c.candidate_registration.full_name)
        : c.choice,
      position: c.position,
      voteCount: c.vote_count ?? null,
    })),
  };

  return NextResponse.json(summary);
}
