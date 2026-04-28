import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { hashToken } from '@/lib/crypto';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { allSlotsAccepted, buildSlots } from '@/lib/team-invites';

/**
 * @swagger
 * /api/team-invites/{token}/accept:
 *   post:
 *     summary: Accept a team-invite token
 *     description: >
 *       Marks the token as used with response=ACCEPTED.  The caller must be
 *       authenticated and may not be the registration's candidate.  Once the
 *       last outstanding slot is accepted, the registration auto-transitions
 *       from AWAITING_TEAM to PENDING_REVIEW within the same transaction.
 *     tags: [TeamInvites]
 *     security:
 *       - cookieAuth: []
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { token } = await params;
  if (!token) return Errors.badRequest('Missing token');
  const hash = hashToken(token);

  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.teamMemberInviteToken.findUnique({
      where: { token_hash: hash },
      include: {
        registration: {
          select: { id: true, user_id: true, status: true, form: { select: { team_size: true } } },
        },
      },
    });

    if (!row) return { ok: false as const, status: 404, error: 'Invite not found' };
    if (row.registration.user_id === auth.user.sub) {
      return {
        ok: false as const,
        status: 403,
        error: 'Кандидат не може прийняти власне запрошення',
      };
    }
    if (row.used_at) {
      return { ok: false as const, status: 409, error: 'Запрошення вже використане' };
    }
    if (row.revoked_at) {
      return { ok: false as const, status: 409, error: 'Запрошення відкликано' };
    }
    if (row.expires_at <= new Date()) {
      return { ok: false as const, status: 410, error: 'Термін дії запрошення минув' };
    }
    if (row.registration.status !== 'AWAITING_TEAM') {
      return { ok: false as const, status: 409, error: 'Заявка вже не приймає членів команди' };
    }

    await tx.teamMemberInviteToken.update({
      where: { token_hash: hash },
      data: {
        used_at: new Date(),
        used_by_user_id: auth.user.sub,
        used_by_full_name: auth.user.fullName,
        response: 'ACCEPTED',
      },
    });

    // Re-fetch all tokens for this registration and decide if status flips
    const all = await tx.teamMemberInviteToken.findMany({
      where: { registration_id: row.registration.id },
    });
    const slots = buildSlots(row.registration.form.team_size, all);

    let newStatus: 'AWAITING_TEAM' | 'PENDING_REVIEW' = 'AWAITING_TEAM';
    if (allSlotsAccepted(slots)) {
      newStatus = 'PENDING_REVIEW';
      await tx.candidateRegistration.update({
        where: { id: row.registration.id },
        data: { status: 'PENDING_REVIEW' },
      });
    }

    return { ok: true as const, newStatus };
  });

  if (!result.ok) return Errors.badRequest(result.error);
  return NextResponse.json({ accepted: true, registrationStatus: result.newStatus });
}
