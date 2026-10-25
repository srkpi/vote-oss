import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { hashToken } from '@/lib/crypto';
import { safeDecrypt } from '@/lib/elections-view';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return Errors.unauthorized(auth.error);
  }

  const { token } = await params;
  if (!token) {
    return Errors.badRequest('Missing token');
  }
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

  if (!row) {
    return Errors.notFound('Invite not found');
  }

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
