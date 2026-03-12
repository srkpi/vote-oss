import { NextRequest, NextResponse } from 'next/server';

import { requireRefreshAuth } from '@/lib/auth';
import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/constants';
import { Errors } from '@/lib/errors';
import { signAccessToken, signRefreshToken, tokenCookieOptions } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { getClientIp, rateLimitRefresh } from '@/lib/rate-limit';
import { persistTokenPair, revokeByRefreshJti } from '@/lib/token-store';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = await rateLimitRefresh(ip);
  if (rl.limited) {
    return NextResponse.json(
      { error: 'TooManyRequests', message: 'Too many refresh requests. Slow down.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.resetInMs / 1_000)) },
      },
    );
  }

  const auth = await requireRefreshAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { user } = auth;

  await revokeByRefreshJti(user.jti, user.iat);

  const adminRecord = await prisma.admin.findUnique({
    where: { user_id: user.sub },
  });
  const isAdmin = !!adminRecord;

  const tokenPayload = {
    sub: user.sub,
    faculty: user.faculty,
    group: user.group,
    full_name: user.full_name,
    is_admin: isAdmin,
  };

  const [{ token: accessToken, jti: accessJti }, { token: refreshToken, jti: refreshJti }] =
    await Promise.all([signAccessToken(tokenPayload), signRefreshToken(tokenPayload)]);

  await persistTokenPair(accessJti, refreshJti);

  const response = NextResponse.json({ ok: true, isAdmin }, { status: 200 });
  response.cookies.set(COOKIE_ACCESS, accessToken, tokenCookieOptions('access'));
  response.cookies.set(COOKIE_REFRESH, refreshToken, tokenCookieOptions('refresh'));

  return response;
}
