import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { hashToken } from '@/lib/crypto';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

/**
 * @swagger
 * /api/team-invites/{token}:
 *   get:
 *     summary: Preview a team-invite token
 *     description: >
 *       Auth-required.  Returns descriptive metadata about the invite —
 *       candidate name, form title, owning group — so the prospective team
 *       member knows what they're agreeing to before clicking accept.
 *     tags: [TeamInvites]
 *     security:
 *       - cookieAuth: []
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
          form: { select: { id: true, title: true, group: { select: { name: true } } } },
        },
      },
    },
  });

  if (!row) return Errors.notFound('Invite not found');

  return NextResponse.json({
    token,
    registrationId: row.registration_id,
    slot: row.slot,
    candidate: { userId: row.registration.user_id, fullName: row.registration.full_name },
    formId: row.registration.form.id,
    formTitle: row.registration.form.title,
    groupName: row.registration.form.group.name,
    expiresAt: row.expires_at.toISOString(),
    used: row.used_at !== null,
    response: row.response,
    revoked: row.revoked_at !== null,
  });
}
