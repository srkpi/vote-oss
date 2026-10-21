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
  if (!auth.ok) {
    return Errors.unauthorized(auth.error);
  }

  const { token } = await params;
  if (!token) {
    return Errors.badRequest('Missing token');
  }
  const hash = hashToken(token);

  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.teamMemberInviteToken.findUnique({
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

    if (!row) {
      return { ok: false as const, status: 404, error: 'Invite not found' };
    }
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

    try {
      assertFormAcceptingTeamActivity(row.registration.form);
    } catch (err) {
      if (err instanceof RegistrationFormNotFoundError) {
        return { ok: false as const, status: 404, error: err.message };
      }
      if (err instanceof RegistrationWindowClosedError) {
        return { ok: false as const, status: 400, error: err.message };
      }
      throw err;
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

  if (!result.ok) {
    if (result.status === 404) {
      return Errors.notFound(result.error);
    }
    if (result.status === 403) {
      return Errors.forbidden(result.error);
    }
    if (result.status === 409) {
      return Errors.conflict(result.error);
    }
    return Errors.badRequest(result.error);
  }
  // Always AWAITING_TEAM at this point: promotion happens on candidate confirm.
  return NextResponse.json({ accepted: true, registrationStatus: 'AWAITING_TEAM' as const });
}
