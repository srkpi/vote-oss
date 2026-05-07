import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { CAMPAIGN_INCLUDE, shapeCampaign, validateCreateCampaignBody } from '@/lib/campaigns';
import { Errors } from '@/lib/errors';
import { GroupForbiddenError, GroupNotFoundError, requireVKSUGroupMember } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';

/**
 * @swagger
 * /api/groups/{id}/campaigns:
 *   get:
 *     summary: List active election campaigns for a group
 *     description: Returns every non-deleted campaign belonging to the group.
 *     tags: [ElectionCampaigns]
 *     security:
 *       - cookieAuth: []
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid group id');

  const group = await prisma.group.findUnique({
    where: { id },
    select: { deleted_at: true },
  });
  if (!group || group.deleted_at) return Errors.notFound('Group not found');

  const campaigns = await prisma.electionCampaign.findMany({
    where: { group_id: id, deleted_at: null },
    include: CAMPAIGN_INCLUDE,
    orderBy: { created_at: 'desc' },
  });

  return NextResponse.json(campaigns.map(shapeCampaign));
}

/**
 * @swagger
 * /api/groups/{id}/campaigns:
 *   post:
 *     summary: Create an election campaign for a ВКСУ group
 *     description: Caller must be an active member of the ВКСУ group.
 *     tags: [ElectionCampaigns]
 *     security:
 *       - cookieAuth: []
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid group id');

  let group: { id: string; name: string };
  try {
    group = await requireVKSUGroupMember(id, auth.user.sub);
  } catch (err) {
    if (err instanceof GroupNotFoundError) return Errors.notFound(err.message);
    if (err instanceof GroupForbiddenError) return Errors.forbidden(err.message);
    throw err;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const validation = validateCreateCampaignBody(body);
  if (!validation.ok) return Errors.badRequest(validation.error);
  const data = validation.data;

  const created = await prisma.electionCampaign.create({
    data: {
      group_id: id,
      position_title: data.positionTitle,
      election_kind: data.electionKind,
      announced_at: data.announcedAt,
      registration_closes_at: data.registrationClosesAt,
      signatures_opens_at: data.signaturesOpensAt,
      signatures_closes_at: data.signaturesClosesAt,
      signature_collection: data.signatureCollection,
      signature_quorum: data.signatureQuorum,
      team_size: data.teamSize,
      requires_campaign_program: data.requiresCampaignProgram,
      voting_opens_at: data.votingOpensAt,
      voting_closes_at: data.votingClosesAt,
      created_by: auth.user.sub,
      created_by_full_name: group.name,
      restrictions: data.restrictions.length
        ? { create: data.restrictions.map((r) => ({ type: r.type, value: r.value })) }
        : undefined,
    },
    include: CAMPAIGN_INCLUDE,
  });

  return NextResponse.json(shapeCampaign(created), { status: 201 });
}
