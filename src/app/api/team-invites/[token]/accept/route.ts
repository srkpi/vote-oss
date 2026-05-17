import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { hashToken } from '@/lib/crypto';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

/**
 * @swagger
 * /api/team-invites/{token}/accept:
 *   post:
 *     summary: Accept a team invite token
 *     description: >
 *       Marks the token as used with response=ACCEPTED and records the
 *       invitee's identity (userId, fullName, group, faculty). After this
 *       the slot enters the `awaiting_candidate` state — the registration's
 *       author must then explicitly confirm or decline via
 *       PATCH /api/registrations/{id}/team/{slot}/decision. The registration
 *       is only auto-promoted to PENDING_REVIEW once the candidate confirms
 *       every slot.
 *
 *       The caller must be authenticated and may not be the registration's
 *       candidate (you cannot accept your own invite).
 *     tags:
 *       - TeamInvites
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Raw (unhashed) team invite token
 *     responses:
 *       200:
 *         description: Invite accepted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - accepted
 *                 - registrationStatus
 *               properties:
 *                 accepted:
 *                   type: boolean
 *                   example: true
 *                 registrationStatus:
 *                   type: string
 *                   enum: [AWAITING_TEAM]
 *                   description: Always AWAITING_TEAM at this point; promotion to PENDING_REVIEW happens on candidate confirmation.
 *       400:
 *         description: Token expired, already used, revoked, registration not accepting team members, or any other terminal-state conflict
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Caller is the registration's candidate (cannot accept own invite)
 *       404:
 *         description: Invite token not found
 *       409:
 *         description: Token already used or revoked
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
      include: { registration: { select: { user_id: true, status: true } } },
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
        used_by_group: auth.user.group,
        used_by_faculty: auth.user.faculty,
        response: 'ACCEPTED',
      },
    });

    return { ok: true as const };
  });

  if (!result.ok) return Errors.badRequest(result.error);
  // Always AWAITING_TEAM at this point: promotion happens on candidate confirm.
  return NextResponse.json({ accepted: true, registrationStatus: 'AWAITING_TEAM' as const });
}
