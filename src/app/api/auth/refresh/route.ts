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
 *       401:
 *         description: Refresh token invalid/revoked, or global bypass was revoked
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

  // If a student gained platform access via a global bypass token, revoking
  // that bypass should invalidate their session. We check whether any of their
  // bypass usages were revoked AFTER they first authenticated (initial_auth_at).
  // This means the next refresh after an admin revokes access will fail,
  // forcing re-login. The user can remain logged in for up to ACCESS_TOKEN_TTL_SECS
  // after revocation (until their current access token expires).
  if (user.initialAuthAt) {
    const now = new Date();
    const initialAuthDate = new Date(user.initialAuthAt * 1000);
    const revokedBypass = await prisma.globalBypassTokenUsage.findFirst({
      where: {
        user_id: user.sub,
        OR: [
          { revoked_at: { gt: initialAuthDate } },
          {
            token: {
              valid_until: {
                gt: initialAuthDate,
                lt: now,
              },
            },
          },
        ],
      },
      select: { id: true },
    });

    if (revokedBypass) {
      return Errors.unauthorized('Your bypass access has been revoked. Please log in again.');
    }
  }

  await revokeByRefreshJti(user.jti, user.iat);

  const initialAuthAt = user.initialAuthAt ?? Math.floor(Date.now() / 1000);
  const tokenPayload: TokenPayload = {
    sub: user.sub,
    faculty: user.faculty,
    group: user.group,
    fullName: user.fullName,
    speciality: user.speciality,
    studyYear: user.studyYear,
    studyForm: user.studyForm,
    initialAuthAt,
  };

  const adminRecord = await prisma.admin.findUnique({
    where: { user_id: user.sub, deleted_at: null },
  });

  if (adminRecord) {
    tokenPayload.isAdmin = true;
    tokenPayload.manageAdmins = adminRecord.manage_admins;
    tokenPayload.restrictedToFaculty = adminRecord.restricted_to_faculty;
  }

  const [{ token: accessToken, jti: accessJti }, { token: refreshToken, jti: refreshJti }] =
    await Promise.all([signAccessToken(tokenPayload), signRefreshToken(tokenPayload)]);

  await persistTokenPair(accessJti, refreshJti, new Date(initialAuthAt * 1000));

  const response = new NextResponse(null, { status: 200 });
  response.cookies.set(COOKIE_ACCESS, accessToken, tokenCookieOptions('access'));
  response.cookies.set(COOKIE_REFRESH, refreshToken, tokenCookieOptions('refresh'));

  return response;
}
