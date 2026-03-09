import { NextRequest, NextResponse } from 'next/server';
import { requireRefreshAuth } from '@/lib/auth';
import {
  signAccessToken,
  signRefreshToken,
  COOKIE_ACCESS,
  COOKIE_REFRESH,
  tokenCookieOptions,
} from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/errors';

export async function POST(req: NextRequest) {
  const auth = await requireRefreshAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { user } = auth;

  await prisma.jwtToken.deleteMany({
    where: { refresh_jti: user.jti },
  });

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
    restricted_to_faculty: adminRecord?.restricted_to_faculty ?? false,
    manage_admins: adminRecord?.manage_admins ?? false,
  };

  const [{ token: accessToken, jti: accessJti }, { token: refreshToken, jti: refreshJti }] =
    await Promise.all([signAccessToken(tokenPayload), signRefreshToken(tokenPayload)]);

  await prisma.jwtToken.create({
    data: {
      access_jti: accessJti,
      refresh_jti: refreshJti,
      created_at: new Date(),
    },
  });

  const response = NextResponse.json({ ok: true, isAdmin }, { status: 200 });
  response.cookies.set(COOKIE_ACCESS, accessToken, tokenCookieOptions('access'));
  response.cookies.set(COOKIE_REFRESH, refreshToken, tokenCookieOptions('refresh'));

  return response;
}
