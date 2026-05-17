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
 *     summary: Get an election campaign by ID
 *     description: >
 *       Returns full campaign details. Any authenticated user may fetch a
 *       campaign; group membership is not required for reading.
 *     tags:
 *       - ElectionCampaigns
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Campaign UUID
 *     responses:
 *       200:
 *         description: Campaign details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ElectionCampaign'
 *       400:
 *         description: Invalid campaign UUID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Campaign not found, soft-deleted, or its group is soft-deleted
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
 *     summary: Cancel an election campaign (soft-delete, state → CANCELLED)
 *     description: >
 *       Soft-deletes the campaign and transitions its state to CANCELLED.
 *       Cancelled campaigns can no longer advance through their state machine.
 *       Caller must be an active member of the campaign's ВКСУ group.
 *     tags:
 *       - ElectionCampaigns
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Campaign UUID
 *     responses:
 *       204:
 *         description: Campaign cancelled
 *       400:
 *         description: Invalid campaign UUID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Caller is not an active member of the campaign's ВКСУ group
 *       404:
 *         description: Campaign not found or already soft-deleted
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
