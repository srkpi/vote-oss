import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { TEAM_INVITE_TOKEN_LENGTH, TEAM_INVITE_TOKEN_TTL_DAYS } from '@/lib/constants';
import { generateBase64Token, hashToken } from '@/lib/crypto';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';

/**
 * @swagger
 * /api/registrations/{id}/team/{slot}:
 *   post:
 *     summary: Generate or regenerate the invite token for a team slot
 *     description: >
 *       Creates a fresh invite token for the specified slot and revokes any
 *       previously active (unused) token for the same slot. The raw plaintext
 *       token is returned exactly once; it is not stored on the server.
 *
 *       This endpoint is blocked when:
 *         - The slot is in `accepted` state (invitee accepted and candidate
 *           confirmed — the slot is locked).
 *         - The registration is not in AWAITING_TEAM state.
 *
 *       Only the registration's author (candidate) may call this endpoint.
 *     tags:
 *       - TeamInvites
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Registration UUID
 *       - in: path
 *         name: slot
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Team slot number (1-indexed, must not exceed the form's team_size)
 *     responses:
 *       200:
 *         description: Invite token generated – raw token returned here only
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - slot
 *                 - token
 *                 - expiresAt
 *               properties:
 *                 slot:
 *                   type: integer
 *                 token:
 *                   type: string
 *                   description: Raw (unhashed) invite token. Share this with the prospective team member; it is not stored on the server.
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid UUID or slot out of range
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Caller is not the registration author
 *       404:
 *         description: Registration not found
 *       409:
 *         description: Registration is not in AWAITING_TEAM state, or the slot is already accepted (locked)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; slot: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id, slot: slotParam } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid registration id');
  const slot = parseInt(slotParam, 10);
  if (!Number.isInteger(slot) || slot < 1) return Errors.badRequest('Invalid slot');

  const reg = await prisma.candidateRegistration.findUnique({
    where: { id },
    include: {
      form: { select: { team_size: true } },
      team_invite_tokens: { where: { slot } },
    },
  });
  if (!reg) return Errors.notFound('Registration not found');
  if (reg.user_id !== auth.user.sub) {
    return Errors.forbidden('Доступно лише автору заявки');
  }
  if (slot > reg.form.team_size) return Errors.badRequest('Slot out of range');
  if (reg.status !== 'AWAITING_TEAM') {
    return Errors.conflict('Запрошення можна створювати лише в стані очікування команди');
  }

  // Latest token for this slot — if it's accepted, slot is locked.
  const latest = reg.team_invite_tokens.reduce<(typeof reg.team_invite_tokens)[number] | null>(
    (acc, t) => (acc === null || t.created_at > acc.created_at ? t : acc),
    null,
  );
  if (latest?.used_at && latest.response === 'ACCEPTED') {
    return Errors.conflict('Цей слот уже зайнятий — створити нове посилання неможливо');
  }

  const plaintext = generateBase64Token(TEAM_INVITE_TOKEN_LENGTH);
  const tokenHash = hashToken(plaintext);
  const expiresAt = new Date(Date.now() + TEAM_INVITE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Revoke any prior active token for this slot (single statement covers
    // pending tokens whose user never responded).
    await tx.teamMemberInviteToken.updateMany({
      where: {
        registration_id: id,
        slot,
        used_at: null,
        revoked_at: null,
      },
      data: { revoked_at: now },
    });

    await tx.teamMemberInviteToken.create({
      data: {
        token_hash: tokenHash,
        registration_id: id,
        slot,
        expires_at: expiresAt,
      },
    });
  });

  return NextResponse.json({ slot, token: plaintext, expiresAt: expiresAt.toISOString() });
}
