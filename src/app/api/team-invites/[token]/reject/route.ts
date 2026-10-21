import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { hashToken } from '@/lib/crypto';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import {
  assertFormAcceptingTeamActivity,
  RegistrationFormNotFoundError,
  RegistrationWindowClosedError,
} from '@/lib/registration-forms';

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
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
          user_id: true,
          status: true,
          form: { select: { deleted_at: true, opens_at: true, closes_at: true } },
        },
      },
    },
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

  try {
    assertFormAcceptingTeamActivity(row.registration.form);
  } catch (err) {
    if (err instanceof RegistrationFormNotFoundError) return Errors.notFound(err.message);
    if (err instanceof RegistrationWindowClosedError) return Errors.badRequest(err.message);
    throw err;
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
