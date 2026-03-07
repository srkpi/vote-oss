import { NextRequest, NextResponse } from 'next/server';
import { resolveTicket } from '@/lib/kpi-id';
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

  const tokenPayload = {
    sub: userInfo.userId,
    faculty: userInfo.faculty,
    group: userInfo.group,
    full_name: userInfo.fullName,
    is_admin: userInfo.isAdmin,
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

  const response = NextResponse.json(
    {
      userId: userInfo.userId,
      fullName: userInfo.fullName,
      faculty: userInfo.faculty,
      group: userInfo.group,
      isAdmin: userInfo.isAdmin,
    },
    { status: 200 },
  );

  response.cookies.set(COOKIE_ACCESS, accessToken, tokenCookieOptions('access'));
  response.cookies.set(COOKIE_REFRESH, refreshToken, tokenCookieOptions('refresh'));

  return response;
}
