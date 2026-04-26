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
 *     summary: Generate (or regenerate) the invite token for a team slot
 *     description: >
 *       Revokes any active token for this slot and creates a fresh one.
 *       Returns the plaintext exactly once — store it in the share UI before
 *       leaving the page.  Forbidden when the slot is already in `accepted`
 *       state (slot is locked) or when the registration is in a final state.
 *     tags: [TeamInvites]
 *     security:
 *       - cookieAuth: []
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
