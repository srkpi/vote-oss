import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireRefreshAuth } from '@/lib/auth';
import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/constants';
import { Errors } from '@/lib/errors';
import { signAccessToken, signRefreshToken, tokenCookieOptions } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { getClientIp, rateLimitRefresh } from '@/lib/rate-limit';
import { persistTokenPair, revokeByRefreshJti } from '@/lib/token-store';
import type { TokenPayload } from '@/types/auth';

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh the access token
 *     description: >
 *       Issues a new access + refresh token pair using the caller's valid
 *       refresh token cookie (token rotation). The old refresh token is
 *       revoked immediately. Admin status is re-evaluated against the database
 *       on every refresh. Rate-limited per IP.
 *     tags:
 *       - Auth
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: New token pair issued; cookies updated
 *         headers:
 *           Set-Cookie:
 *             description: Rotated HTTP-only access and refresh token cookies
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 isAdmin:
 *                   type: boolean
 *       401:
 *         description: Refresh token is missing, invalid, or already revoked
 *       429:
 *         description: Too many refresh requests
 *         headers:
 *           Retry-After:
 *             schema:
 *               type: integer
 */
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

  const tokenPayload: TokenPayload = {
    sub: user.sub,
    faculty: user.faculty,
    group: user.group,
    fullName: user.fullName,
  };
  const adminRecord = await prisma.admin.findUnique({
    where: { user_id: user.sub },
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

  const response = NextResponse.json({ ok: true, isAdmin }, { status: 200 });
  response.cookies.set(COOKIE_ACCESS, accessToken, tokenCookieOptions('access'));
  response.cookies.set(COOKIE_REFRESH, refreshToken, tokenCookieOptions('refresh'));

  return response;
}
