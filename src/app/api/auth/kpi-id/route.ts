import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/constants';
import { Errors } from '@/lib/errors';
import { signAccessToken, signRefreshToken, tokenCookieOptions } from '@/lib/jwt';
import { NotStudentError, resolveTicket } from '@/lib/kpi-id';
import { prisma } from '@/lib/prisma';
import { getClientIp, rateLimitLogin } from '@/lib/rate-limit';
import { persistTokenPair, revokeByAccessJti } from '@/lib/token-store';
import type { TokenPayload } from '@/types/auth';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = await rateLimitLogin(ip);
  if (rl.limited) {
    return NextResponse.json(
      { error: 'TooManyRequests', message: 'Too many login attempts. Try again shortly.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rl.resetInMs / 1_000)),
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  let body: { ticketId?: string };
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { ticketId } = body;
  if (!ticketId || typeof ticketId !== 'string') {
    return Errors.badRequest('ticketId is required');
  }

  let userInfo;
  try {
    userInfo = await resolveTicket(ticketId);
  } catch (err) {
    if (err instanceof NotStudentError) {
      return Errors.forbidden(err.message);
    }

    console.error('[auth/kpi-id] resolveTicket error:', err);
    return Errors.internal('Failed to contact auth provider');
  }

  if (!userInfo) {
    return Errors.unauthorized('Invalid or expired ticketId');
  }

  const auth = await requireAuth(req);
  if (auth.ok) {
    await revokeByAccessJti(auth.user.jti, auth.user.iat);
  }

  const tokenPayload: TokenPayload = {
    sub: userInfo.userId,
    faculty: userInfo.faculty,
    group: userInfo.group,
    fullName: userInfo.fullName,
  };
  const adminRecord = await prisma.admin.findUnique({
    where: { user_id: userInfo.userId, deleted_at: null },
  });
  const isAdmin = !!adminRecord;

  if (isAdmin) {
    tokenPayload['isAdmin'] = true;
    tokenPayload['manageAdmins'] = adminRecord.manage_admins;
    tokenPayload['restrictedToFaculty'] = adminRecord.restricted_to_faculty;
  }

  const [{ token: accessToken, jti: accessJti }, { token: refreshToken, jti: refreshJti }] =
    await Promise.all([signAccessToken(tokenPayload), signRefreshToken(tokenPayload)]);

  await persistTokenPair(accessJti, refreshJti);

  const response = NextResponse.json(
    {
      userId: userInfo.userId,
      fullName: userInfo.fullName,
      faculty: userInfo.faculty,
      group: userInfo.group,
      isAdmin,
    },
    { status: 200 },
  );

  response.cookies.set(COOKIE_ACCESS, accessToken, tokenCookieOptions('access'));
  response.cookies.set(COOKIE_REFRESH, refreshToken, tokenCookieOptions('refresh'));

  return response;
}
