import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { applyBypassToken } from '@/lib/bypass';
import { KPI_AUTH_URL } from '@/lib/config/client';
import {
  COOKIE_ACCESS,
  COOKIE_PENDING_BYPASS,
  COOKIE_REFRESH,
  COOKIE_RETURN_TO,
} from '@/lib/constants';
import { Errors } from '@/lib/errors';
import { signAccessToken, signRefreshToken, tokenCookieOptions } from '@/lib/jwt';
import { getCampusUserData } from '@/lib/kpi-id';
import { prisma } from '@/lib/prisma';
import { persistTokenPair, revokeByAccessJti } from '@/lib/token-store';
import type { KpiIdUserInfo, TokenPayload } from '@/types/auth';

interface CheckResponse {
  status: 'Processing' | 'Finished';
  sessionId: string;
}

/**
 * Extract the bare `name=value` pairs from a set of Set-Cookie header strings,
 * suitable for forwarding as a Cookie request header.
 */
function extractCookieValues(setCookieHeaders: string[]): string {
  return setCookieHeaders
    .map((header) => {
      const semi = header.indexOf(';');
      return semi === -1 ? header : header.slice(0, semi);
    })
    .join('; ');
}

/**
 * @swagger
 * /api/auth/diia/check:
 *   post:
 *     summary: Poll Diia authentication status
 *     description: >
 *       Checks whether the user has scanned and approved the Diia QR code.
 *       Returns `{ status: "processing" }` while waiting. When the user
 *       completes Diia verification this endpoint exchanges the sessionId for
 *       KPI-ID session cookies, fetches the authenticated user profile, and
 *       issues a new JWT access + refresh token pair via HTTP-only cookies.
 *       Graduate users are rejected with 403.
 *
 *       If a `pending_bypass` cookie is present (set when an unauthenticated
 *       user visited /use/[token]), the bypass is pre-applied before the
 *       campus eligibility check, breaking the login chicken-and-egg.
 *
 *       On success the response body includes `redirectTo` so the client
 *       does not need a separate /api/auth/return-to call.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - requestId
 *             properties:
 *               requestId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [success, processing]
 *                 redirectTo:
 *                   type: string
 *                   description: Present only when status is "success"
 *       400:
 *         description: Missing requestId
 *       401:
 *         description: Incomplete user data returned by provider
 *       403:
 *         description: Account is not a student or is a graduate student
 *       500:
 *         description: Provider error
 */
export async function POST(req: NextRequest) {
  let body: { requestId?: string };
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { requestId } = body;
  if (!requestId) return Errors.badRequest('requestId is required');

  let checkData: CheckResponse;
  try {
    const url = new URL(`${KPI_AUTH_URL}/api/diia/check-request`);
    url.searchParams.set('requestId', requestId);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      return NextResponse.json({ status: 'processing' });
    }

    checkData = (await res.json()) as CheckResponse;
  } catch (err) {
    console.error('[diia/check] poll error:', err);
    return NextResponse.json({ status: 'processing' });
  }

  if (checkData.status !== 'Finished') {
    return NextResponse.json({ status: 'processing' });
  }

  const { sessionId } = checkData;

  let kpiCookieHeader: string;
  try {
    const internalRes = await fetch(new URL(`${KPI_AUTH_URL}/api/auth/internal`).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    if (!internalRes.ok) {
      console.error('[diia/check] internal auth failed:', internalRes.status);
      return Errors.internal('Failed to authenticate with provider');
    }

    // getSetCookie is available in Node 18+
    const setCookies =
      typeof internalRes.headers.getSetCookie === 'function'
        ? internalRes.headers.getSetCookie()
        : (() => {
            const raw = internalRes.headers.get('set-cookie');
            return raw ? [raw] : [];
          })();

    kpiCookieHeader = extractCookieValues(setCookies);
  } catch (err) {
    console.error('[diia/check] internal auth error:', err);
    return Errors.internal('Failed to authenticate with provider');
  }

  if (!kpiCookieHeader) {
    console.error('[diia/check] no session cookies received from provider');
    return Errors.internal('No session cookies received from provider');
  }

  let userData: { data: KpiIdUserInfo };
  try {
    const userRes = await fetch(`${KPI_AUTH_URL}/api/user`, {
      method: 'GET',
      headers: { Cookie: kpiCookieHeader, Accept: 'application/json' },
    });

    if (!userRes.ok) {
      console.error('[diia/check] user fetch failed:', userRes.status);
      return Errors.internal('Failed to retrieve user data from provider');
    }

    userData = (await userRes.json()) as { data: KpiIdUserInfo };
  } catch (err) {
    console.error('[diia/check] user fetch error:', err);
    return Errors.internal('Failed to retrieve user data from provider');
  } finally {
    fetch(`${KPI_AUTH_URL}/api/auth/logout`, {
      method: 'GET',
      headers: { Cookie: kpiCookieHeader },
    }).catch((err) => console.error('[diia/check] KPI-ID logout error:', err));
  }

  const { data } = userData;
  if (!data) {
    console.error('[diia/check] provider returned empty data field');
    return Errors.internal('Invalid user data from provider');
  }

  // Pre-apply a pending bypass token stored by the proxy when the user was
  // redirected from /use/[token] to /login while unauthenticated.
  // Must happen BEFORE getCampusUserData so getUserBypassInfo finds the record.
  const pendingBypassToken = req.cookies.get(COOKIE_PENDING_BYPASS)?.value;
  let pendingBypassResult: { type: 'GLOBAL' | 'ELECTION'; electionId: string | null } | null = null;
  if (pendingBypassToken) {
    try {
      pendingBypassResult = await applyBypassToken(data.STUDENT_ID, pendingBypassToken);
    } catch {
      // Token invalid, expired, or limit reached — proceed with normal auth flow.
    }
  }

  const campusDataResult = await getCampusUserData(data);
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

  if (adminRecord) {
    tokenPayload.isAdmin = true;
    tokenPayload.manageAdmins = adminRecord.manage_admins;
    tokenPayload.restrictedToFaculty = adminRecord.restricted_to_faculty;
    tokenPayload.manageGroups = adminRecord.manage_groups;
    tokenPayload.managePetitions = adminRecord.manage_petitions;
  }

  const [{ token: accessToken, jti: accessJti }, { token: refreshToken, jti: refreshJti }] =
    await Promise.all([signAccessToken(tokenPayload), signRefreshToken(tokenPayload)]);

  await persistTokenPair(accessJti, refreshJti, new Date(initialAuthAt * 1000));

  // Compute post-login redirect. Prefer derived redirect from pre-applied
  // bypass; otherwise fall back to the stored return_to cookie.
  const returnTo = req.cookies.get(COOKIE_RETURN_TO)?.value;
  const redirectTo = pendingBypassResult
    ? pendingBypassResult.type === 'ELECTION' && pendingBypassResult.electionId
      ? `/elections/${pendingBypassResult.electionId}`
      : '/elections'
    : returnTo && returnTo.startsWith('/')
      ? returnTo
      : '/elections';

  const response = NextResponse.json({ status: 'success', redirectTo });

  response.cookies.set(COOKIE_ACCESS, accessToken, tokenCookieOptions('access'));
  response.cookies.set(COOKIE_REFRESH, refreshToken, tokenCookieOptions('refresh'));
  response.cookies.set(COOKIE_PENDING_BYPASS, '', { maxAge: 0, path: '/' });
  response.cookies.set(COOKIE_RETURN_TO, '', { maxAge: 0, path: '/' });

  return response;
}
