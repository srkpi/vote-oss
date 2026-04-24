import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { applyBypassToken } from '@/lib/bypass';
import {
  COOKIE_ACCESS,
  COOKIE_PENDING_BYPASS,
  COOKIE_REFRESH,
  COOKIE_RETURN_TO,
} from '@/lib/constants';
import { Errors } from '@/lib/errors';
import { signAccessToken, signRefreshToken, tokenCookieOptions } from '@/lib/jwt';
import {
  getCampusUserData,
  InvalidTicketError,
  InvalidUserDataError,
  resolveTicket,
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
 *
 *       If a `pending_bypass` cookie is present (set by the proxy when an
 *       unauthenticated user was redirected from /use/[token]), the endpoint
 *       attempts to pre-apply that bypass token before checking campus eligibility.
 *       This resolves the chicken-and-egg situation where a student needs the
 *       bypass to log in but could previously only apply tokens after login.
 *
 *       Returns a JSON body with `redirectTo` so the client does not need a
 *       separate call to /api/auth/return-to.
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 redirectTo:
 *                   type: string
 *                   description: Post-login redirect path
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

  let kpiIdInfo;
  try {
    kpiIdInfo = await resolveTicket(ticketId);
  } catch (err) {
    if (err instanceof InvalidTicketError || err instanceof InvalidUserDataError) {
      return Errors.unauthorized(err.message);
    }
    return Errors.forbidden((err as Error).message);
  }

  // Pre-apply a pending bypass token stored by the proxy when the user was
  // redirected from /use/[token] to /login while unauthenticated.
  // We do this BEFORE getCampusUserData so that the bypass is already in the
  // DB when getUserBypassInfo is called inside getCampusUserData.
  const pendingBypassToken = req.cookies.get(COOKIE_PENDING_BYPASS)?.value;
  let pendingBypassResult: { type: 'GLOBAL' | 'ELECTION'; electionId: string | null } | null = null;
  if (pendingBypassToken) {
    try {
      pendingBypassResult = await applyBypassToken(kpiIdInfo.STUDENT_ID, pendingBypassToken);
    } catch {
      // Token invalid, expired, or limit reached — proceed with normal auth flow.
      // getCampusUserData will still return 403 if the user genuinely can't log in.
    }
  }

  const campusDataResult = await getCampusUserData(kpiIdInfo);
  if (campusDataResult instanceof NextResponse) {
    return campusDataResult;
  }

  const auth = await requireAuth(req);
  if (auth.ok) await revokeByAccessJti(auth.user.jti, auth.user.iat);

  const now = Math.floor(Date.now() / 1000);
  const initialAuthAt = now;

  const tokenPayload: TokenPayload = {
    sub: campusDataResult.userId,
    faculty: campusDataResult.faculty,
    group: campusDataResult.group,
    fullName: campusDataResult.fullName,
    speciality: campusDataResult.speciality,
    studyYear: campusDataResult.studyYear,
    studyForm: campusDataResult.studyForm,
    initialAuthAt,
  };

  const adminRecord = await prisma.admin.findUnique({
    where: { user_id: campusDataResult.userId, deleted_at: null },
  });
  const isAdmin = !!adminRecord;

  if (isAdmin) {
    tokenPayload.isAdmin = true;
    tokenPayload.manageAdmins = adminRecord.manage_admins;
    tokenPayload.restrictedToFaculty = adminRecord.restricted_to_faculty;
    tokenPayload.manageGroups = adminRecord.manage_groups;
    tokenPayload.managePetitions = adminRecord.manage_petitions;
    tokenPayload.manageFaq = adminRecord.manage_faq;
  }

  const [{ token: accessToken, jti: accessJti }, { token: refreshToken, jti: refreshJti }] =
    await Promise.all([signAccessToken(tokenPayload), signRefreshToken(tokenPayload)]);

  await persistTokenPair(accessJti, refreshJti, new Date(initialAuthAt * 1000));

  const returnTo = req.cookies.get(COOKIE_RETURN_TO)?.value;
  const redirectTo = pendingBypassResult
    ? pendingBypassResult.type === 'ELECTION' && pendingBypassResult.electionId
      ? `/elections/${pendingBypassResult.electionId}`
      : '/elections'
    : returnTo && returnTo.startsWith('/')
      ? returnTo
      : '/elections';

  const response = NextResponse.json({ redirectTo }, { status: 200 });

  response.cookies.set(COOKIE_ACCESS, accessToken, tokenCookieOptions('access'));
  response.cookies.set(COOKIE_REFRESH, refreshToken, tokenCookieOptions('refresh'));
  response.cookies.set(COOKIE_PENDING_BYPASS, '', { maxAge: 0, path: '/' });
  response.cookies.set(COOKIE_RETURN_TO, '', { maxAge: 0, path: '/' });

  return response;
}
