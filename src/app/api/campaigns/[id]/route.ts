import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { CAMPAIGN_INCLUDE, shapeCampaign } from '@/lib/campaigns';
import { Errors } from '@/lib/errors';
import { GroupForbiddenError, GroupNotFoundError, requireVKSUGroupMember } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';

/**
 * @swagger
 * /api/campaigns/{id}:
 *   get:
 *     summary: Get an election campaign by id
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
    include: CAMPAIGN_INCLUDE,
  });
  if (!campaign || campaign.deleted_at) return Errors.notFound('Campaign not found');
  if (campaign.group.deleted_at !== null) return Errors.notFound('Campaign not found');

  return NextResponse.json(shapeCampaign(campaign));
}

/**
 * @swagger
 * /api/campaigns/{id}:
 *   delete:
 *     summary: Soft-delete an election campaign (state → CANCELLED)
 *     description: Caller must be an active ВКСУ member of the campaign's group.
 *     tags: [ElectionCampaigns]
 *     security:
 *       - cookieAuth: []
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid campaign id');

  const existing = await prisma.electionCampaign.findUnique({
    where: { id },
    select: { id: true, group_id: true, deleted_at: true, state: true },
  });
  if (!existing || existing.deleted_at) return Errors.notFound('Campaign not found');

  try {
    await requireVKSUGroupMember(existing.group_id, auth.user.sub);
  } catch (err) {
    if (err instanceof GroupNotFoundError) return Errors.notFound(err.message);
    if (err instanceof GroupForbiddenError) return Errors.forbidden(err.message);
    throw err;
  }

  await prisma.electionCampaign.update({
    where: { id },
    data: {
      deleted_at: new Date(),
      deleted_by: auth.user.sub,
      state: 'CANCELLED',
    },
  });

  return new NextResponse(null, { status: 204 });
}
