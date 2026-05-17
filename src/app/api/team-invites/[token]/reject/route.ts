import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { hashToken } from '@/lib/crypto';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

/**
 * @swagger
 * /api/team-invites/{token}/reject:
 *   post:
 *     summary: Decline a team invite token
 *     description: >
 *       Marks the token as used with response=REJECTED. After this the slot
 *       returns to `rejected` state and the candidate may regenerate a fresh
 *       invite token for the same slot. The caller must be authenticated and
 *       may not be the registration's candidate.
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
 *         description: Invite declined
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - rejected
 *               properties:
 *                 rejected:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Missing token or token has expired
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Caller is the registration's candidate (cannot reject own invite)
 *       404:
 *         description: Invite token not found
 *       409:
 *         description: Token already used, revoked, or registration no longer accepting team members
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { token } = await params;
  if (!token) return Errors.badRequest('Missing token');
  const hash = hashToken(token);

  const row = await prisma.teamMemberInviteToken.findUnique({
    where: { token_hash: hash },
    include: { registration: { select: { user_id: true, status: true } } },
  });
  if (!row) return Errors.notFound('Invite not found');
  if (row.registration.user_id === auth.user.sub) {
    return Errors.forbidden('Кандидат не може відхилити власне запрошення');
  }
  if (row.used_at) return Errors.conflict('Запрошення вже використане');
  if (row.revoked_at) return Errors.conflict('Запрошення відкликано');
  if (row.expires_at <= new Date()) return Errors.badRequest('Термін дії запрошення минув');
  if (row.registration.status !== 'AWAITING_TEAM') {
    return Errors.conflict('Заявка вже не приймає членів команди');
  }

  await prisma.teamMemberInviteToken.update({
    where: { token_hash: hash },
    data: {
      used_at: new Date(),
      used_by_user_id: auth.user.sub,
      used_by_full_name: auth.user.fullName,
      response: 'REJECTED',
    },
  });

  return NextResponse.json({ rejected: true });
}
