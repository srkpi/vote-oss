import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import {
  applyCampaignDatesUpdate,
  CAMPAIGN_INCLUDE,
  shapeCampaign,
  validateCampaignDatesUpdate,
} from '@/lib/campaigns';
import { Errors } from '@/lib/errors';
import { GroupForbiddenError, GroupNotFoundError, requireVKSUGroupMember } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';

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

const LOCKED_CAMPAIGN_STATES = new Set(['CANCELLED', 'FAILED', 'COMPLETED']);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid campaign id');

  const existing = await prisma.electionCampaign.findUnique({
    where: { id },
    select: {
      id: true,
      group_id: true,
      deleted_at: true,
      state: true,
      announced_at: true,
      registration_closes_at: true,
      signatures_opens_at: true,
      signatures_closes_at: true,
      voting_opens_at: true,
      voting_closes_at: true,
    },
  });
  if (!existing || existing.deleted_at) return Errors.notFound('Campaign not found');

  try {
    await requireVKSUGroupMember(existing.group_id, auth.user.sub);
  } catch (err) {
    if (err instanceof GroupNotFoundError) return Errors.notFound(err.message);
    if (err instanceof GroupForbiddenError) return Errors.forbidden(err.message);
    throw err;
  }

  if (LOCKED_CAMPAIGN_STATES.has(existing.state)) {
    return Errors.badRequest(`Cannot edit a campaign in state ${existing.state}`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const validation = validateCampaignDatesUpdate(body, existing);
  if (!validation.ok) return Errors.badRequest(validation.error);

  const updated = await applyCampaignDatesUpdate(id, validation.data, auth.user.sub);

  return NextResponse.json(shapeCampaign(updated));
}

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
