import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/constants';
import { Errors } from '@/lib/errors';
import { signAccessToken, signRefreshToken, tokenCookieOptions } from '@/lib/jwt';
import {
  InvalidTicketError,
  InvalidUserDataError,
  resolveTicket,
  ResolveUserDataError,
} from '@/lib/kpi-id';
import { prisma } from '@/lib/prisma';
import { getClientIp, rateLimitLogin } from '@/lib/rate-limit';
import { persistTokenPair, revokeByAccessJti } from '@/lib/token-store';
import type { TokenPayload } from '@/types/auth';

/**
 * @swagger
 * /api/auth/kpi-id:
 *   post:
 *     summary: Authenticate via KPI-ID ticket
 *     description: >
 *       Exchanges a KPI-ID CAS ticket for a pair of HTTP-only JWT cookies
 *       (access + refresh). The ticket must have been issued through Diia
 *       authentication (AUTH_METHOD === "DIIA"). Non-student accounts,
 *       graduate students, and tickets issued via other auth methods are
 *       rejected. Rate-limited per IP.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ticketId
 *             properties:
 *               ticketId:
 *                 type: string
 *                 description: CAS service ticket obtained from the KPI-ID provider
 *     responses:
 *       200:
 *         description: Authentication successful; JWT cookies set
 *         headers:
 *           Set-Cookie:
 *             description: HTTP-only access and refresh token cookies
 *             schema:
 *               type: string
 *       400:
 *         description: Missing or invalid ticketId
 *       401:
 *         description: Ticket is invalid or expired
 *       403:
 *         description: Account is not a student, not authenticated through Diia, or is a graduate student
 *       429:
 *         description: Too many login attempts
 *         headers:
 *           Retry-After:
 *             schema:
 *               type: integer
 *       500:
 *         description: Failed to contact the KPI-ID auth provider
 */
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
    if (err instanceof InvalidTicketError || err instanceof InvalidUserDataError) {
      return Errors.unauthorized(err.message);
    }
    if (err instanceof ResolveUserDataError) {
      return Errors.forbidden(err.message);
    }
    console.error('[auth/kpi-id] resolveTicket error:', err);
    return Errors.internal('Failed to contact auth provider');
  }

  const auth = await requireAuth(req);
  if (auth.ok) await revokeByAccessJti(auth.user.jti, auth.user.iat);

  const tokenPayload: TokenPayload = {
    sub: userInfo.userId,
    faculty: userInfo.faculty,
    group: userInfo.group,
    fullName: userInfo.fullName,
    speciality: userInfo.speciality,
    studyYear: userInfo.studyYear,
    studyForm: userInfo.studyForm,
  };

  const adminRecord = await prisma.admin.findUnique({
    where: { user_id: userInfo.userId, deleted_at: null },
  });
  const isAdmin = !!adminRecord;

  if (isAdmin) {
    tokenPayload.isAdmin = true;
    tokenPayload.manageAdmins = adminRecord.manage_admins;
    tokenPayload.restrictedToFaculty = adminRecord.restricted_to_faculty;
  }

  const [{ token: accessToken, jti: accessJti }, { token: refreshToken, jti: refreshJti }] =
    await Promise.all([signAccessToken(tokenPayload), signRefreshToken(tokenPayload)]);

  await persistTokenPair(accessJti, refreshJti);

  const response = new NextResponse(null, { status: 200 });

  response.cookies.set(COOKIE_ACCESS, accessToken, tokenCookieOptions('access'));
  response.cookies.set(COOKIE_REFRESH, refreshToken, tokenCookieOptions('refresh'));

  return response;
}
