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

const LOCKED_CAMPAIGN_STATES = new Set(['CANCELLED', 'FAILED', 'COMPLETED']);

/**
 * @swagger
 * /api/campaigns/{id}:
 *   patch:
 *     summary: Edit a campaign's phase-boundary timestamps
 *     description: >
 *       Changes the campaign's phase-boundary timestamps (announcedAt,
 *       registrationClosesAt, signaturesOpensAt, signaturesClosesAt,
 *       votingOpensAt, votingClosesAt). No other field can be changed here.
 *       Replace-all semantics — send every timestamp, including ones you're
 *       not changing (echo back the current value). Caller must be an
 *       active member of the campaign's ВКСУ group.
 *
 *       Which fields accept a new value depends on the current time versus
 *       each boundary:
 *         - a boundary already in the past is locked (its stage has already
 *           begun and can't be un-started);
 *         - the boundary ending the currently in-progress stage may only be
 *           moved later ("extend", never shortened) — useful for pushing a
 *           deadline back if problems come up mid-stage;
 *         - every boundary after that (stage not yet begun) is free to move
 *           either way.
 *       `GET`/`POST` responses expose this per-field as `stageEditability`.
 *       A campaign that is CANCELLED, FAILED, or COMPLETED can't be edited
 *       at all. If a still-editable `announcedAt` is moved into the past it
 *       is clamped to the current time, same as creation. Editing a
 *       boundary that already has a spawned registration form / signature
 *       elections / final election updates those too, so the change actually
 *       takes effect.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateElectionCampaignDatesBody'
 *     responses:
 *       200:
 *         description: Campaign updated; returns the full updated campaign
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ElectionCampaign'
 *       400:
 *         description: >
 *           Invalid UUID, body validation error, an attempted change to a
 *           locked or extend-only boundary, or the campaign is in a
 *           terminal state (CANCELLED/FAILED/COMPLETED)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Caller is not an active member of the campaign's ВКСУ group
 *       404:
 *         description: Campaign not found or soft-deleted
 */
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
