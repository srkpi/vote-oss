import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { hashToken } from '@/lib/crypto';
import { safeDecrypt } from '@/lib/elections-view';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

/**
 * @swagger
 * /api/team-invites/{token}:
 *   get:
 *     summary: Preview a team invite token
 *     description: >
 *       Returns descriptive metadata about the team invite — candidate name,
 *       form title, owning group name, token validity, and current status —
 *       so the prospective team member knows what they are agreeing to before
 *       accepting or rejecting. Authentication is required; the prospective
 *       member must be logged in to respond.
 *
 *       `formClosed` is true when the form has been soft-deleted or its
 *       submission window ([opensAt, closesAt]) has ended. The preview still
 *       renders in that case (200) — accept/reject will fail with 400/404 —
 *       so the UI can explain why rather than showing a bare error.
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
 *         description: Raw (unhashed) team invite token received from the candidate
 *     responses:
 *       200:
 *         description: Invite preview
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TeamInvitePreview'
 *       400:
 *         description: Missing token parameter
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Invite token not found (invalid or never existed)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { token } = await params;
  if (!token) return Errors.badRequest('Missing token');
  const hash = hashToken(token);

  const row = await prisma.teamMemberInviteToken.findUnique({
    where: { token_hash: hash },
    include: {
      registration: {
        select: {
          id: true,
          user_id: true,
          full_name: true,
          status: true,
          form: {
            select: {
              id: true,
              title: true,
              deleted_at: true,
              opens_at: true,
              closes_at: true,
              group: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!row) return Errors.notFound('Invite not found');

  const form = row.registration.form;
  const now = new Date();
  const formClosed = form.deleted_at !== null || now < form.opens_at || now > form.closes_at;

  return NextResponse.json({
    token,
    registrationId: row.registration_id,
    slot: row.slot,
    candidate: {
      userId: row.registration.user_id,
      fullName: safeDecrypt(row.registration.full_name),
    },
    formId: form.id,
    formTitle: form.title,
    groupName: form.group.name,
    expiresAt: row.expires_at.toISOString(),
    used: row.used_at !== null,
    response: row.response,
    candidateDecision: row.candidate_decision,
    revoked: row.revoked_at !== null,
    formClosed,
  });
}
