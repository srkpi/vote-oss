import { NextRequest, NextResponse } from 'next/server';

import { Errors } from '@/lib/errors';
import {
  COOKIE_ACCESS,
  COOKIE_REFRESH,
  signAccessToken,
  signRefreshToken,
  tokenCookieOptions,
} from '@/lib/jwt';
import { resolveTicket } from '@/lib/kpi-id';
import { prisma } from '@/lib/prisma';
import { getClientIp, rateLimitLogin } from '@/lib/rate-limit';
import { persistTokenPair } from '@/lib/token-store';

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
    console.error('[auth/kpi-id] resolveTicket error:', err);
    return Errors.internal('Failed to contact auth provider');
  }

  if (!userInfo) {
    return Errors.unauthorized('Invalid or expired ticket');
  }

  const adminRecord = await prisma.admin.findUnique({
    where: { user_id: userInfo.userId },
  });
  const isAdmin = !!adminRecord;
  const tokenPayload = {
    sub: userInfo.userId,
    faculty: userInfo.faculty,
    group: userInfo.group,
    full_name: userInfo.fullName,
    is_admin: isAdmin,
  };

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
