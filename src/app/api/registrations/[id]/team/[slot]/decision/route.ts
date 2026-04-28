import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { allSlotsAccepted, buildSlots } from '@/lib/team-invites';
import { isValidUuid } from '@/lib/utils/common';

/**
 * @swagger
 * /api/registrations/{id}/team/{slot}/decision:
 *   patch:
 *     summary: Candidate confirms or declines an invitee who already accepted
 *     description: >
 *       After a team member follows their invite link and accepts, the slot
 *       enters `awaiting_candidate` — the candidate must explicitly confirm
 *       or decline that person.  Confirming locks the slot; declining frees
 *       the slot so the candidate can regenerate a fresh invite for someone
 *       else.  Once every slot is confirmed, the registration auto-transitions
 *       from AWAITING_TEAM to PENDING_REVIEW within the same transaction.
 *     tags: [TeamInvites]
 *     security:
 *       - cookieAuth: []
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; slot: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id, slot: slotParam } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid registration id');
  const slot = parseInt(slotParam, 10);
  if (!Number.isInteger(slot) || slot < 1) return Errors.badRequest('Invalid slot');

  let body: { decision?: 'CONFIRMED' | 'DECLINED' };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }
  if (body.decision !== 'CONFIRMED' && body.decision !== 'DECLINED') {
    return Errors.badRequest('decision must be CONFIRMED or DECLINED');
  }
  const decision = body.decision;

  const result = await prisma.$transaction(async (tx) => {
    const reg = await tx.candidateRegistration.findUnique({
      where: { id },
      include: {
        form: { select: { team_size: true } },
        team_invite_tokens: { where: { slot } },
      },
    });
    if (!reg) return { ok: false as const, status: 404, error: 'Registration not found' };
    if (reg.user_id !== auth.user.sub) {
      return { ok: false as const, status: 403, error: 'Доступно лише автору заявки' };
    }
    if (reg.status !== 'AWAITING_TEAM') {
      return {
        ok: false as const,
        status: 409,
        error: 'Рішення можна приймати лише в стані очікування команди',
      };
    }
    if (slot > reg.form.team_size) {
      return { ok: false as const, status: 400, error: 'Slot out of range' };
    }

    // Latest token for this slot — only it carries the slot's current state.
    const latest = reg.team_invite_tokens.reduce<(typeof reg.team_invite_tokens)[number] | null>(
      (acc, t) => (acc === null || t.created_at > acc.created_at ? t : acc),
      null,
    );

    if (
      !latest ||
      !latest.used_at ||
      latest.response !== 'ACCEPTED' ||
      latest.candidate_decision !== null
    ) {
      return {
        ok: false as const,
        status: 409,
        error: 'Цей слот не очікує підтвердження кандидата',
      };
    }

    await tx.teamMemberInviteToken.update({
      where: { token_hash: latest.token_hash },
      data: {
        candidate_decision: decision,
        candidate_decided_at: new Date(),
      },
    });

    let newStatus: 'AWAITING_TEAM' | 'PENDING_REVIEW' = 'AWAITING_TEAM';
    if (decision === 'CONFIRMED') {
      const all = await tx.teamMemberInviteToken.findMany({
        where: { registration_id: id },
      });
      const slots = buildSlots(reg.form.team_size, all);
      if (allSlotsAccepted(slots)) {
        newStatus = 'PENDING_REVIEW';
        await tx.candidateRegistration.update({
          where: { id },
          data: { status: 'PENDING_REVIEW' },
        });
      }
    }

    return { ok: true as const, newStatus };
  });

  if (!result.ok) {
    if (result.status === 404) return Errors.notFound(result.error);
    if (result.status === 403) return Errors.forbidden(result.error);
    if (result.status === 409) return Errors.conflict(result.error);
    return Errors.badRequest(result.error);
  }

  return NextResponse.json({
    slot,
    decision,
    registrationStatus: result.newStatus,
  });
}
