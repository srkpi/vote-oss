import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/constants';
import { Errors } from '@/lib/errors';
import { revokeByAccessJti } from '@/lib/token-store';

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Log out the current user
 *     description: >
 *       Revokes the caller's access token in the token store and clears both
 *       the access and refresh JWT cookies. Requires a valid access token.
 *     tags:
 *       - Auth
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully; cookies cleared
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Unauthorized – no valid access token present
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { user } = auth;

  await revokeByAccessJti(user.jti, user.iat);

  const response = NextResponse.json({ ok: true }, { status: 200 });

  const clearCookie = (name: string) =>
    response.cookies.set(name, '', { httpOnly: true, maxAge: 0, path: '/' });

  clearCookie(COOKIE_ACCESS);
  clearCookie(COOKIE_REFRESH);

  return response;
}
