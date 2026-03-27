import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { KPI_AUTH_URL } from '@/lib/config/client';
import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/constants';
import { Errors } from '@/lib/errors';
import { signAccessToken, signRefreshToken, tokenCookieOptions } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { persistTokenPair, revokeByAccessJti } from '@/lib/token-store';
import type { TokenPayload } from '@/types/auth';

interface CheckResponse {
  status: 'Processing' | 'Finished';
  sessionId: string;
}

interface KpiUserData {
  fullName?: string;
  data?: {
    EMPLOYEE_ID?: string;
    STUDENT_ID?: string;
    NAME?: string;
    AUTH_METHOD?: string;
    [key: string]: string | undefined;
  };
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
 *   get:
 *     summary: Poll Diia authentication status
 *     description: >
 *       Checks whether the user has scanned and approved the Diia QR code for
 *       the given requestId.  Returns `{ status: "processing" }` while waiting.
 *       When the user completes Diia verification, this endpoint:
 *         1. Exchanges the sessionId for KPI-ID session cookies.
 *         2. Fetches the authenticated user profile.
 *         3. Issues a new JWT access + refresh token pair via HTTP-only cookies.
 *         4. Revokes any pre-existing session for the browser that made this call.
 *       Returns `{ status: "success", userId, fullName, isAdmin }` on completion.
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: query
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status response
 *       400:
 *         description: Missing requestId
 *       403:
 *         description: Account is not a student
 *       500:
 *         description: Provider error
 */
export async function GET(req: NextRequest) {
  const requestId = req.nextUrl.searchParams.get('requestId');
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
      // Treat non-OK as still processing (the requestId may no longer exist).
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
    const internalUrl = new URL(`${KPI_AUTH_URL}/api/auth/internal`);
    const internalRes = await fetch(internalUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
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

  let userData: KpiUserData;
  try {
    const userRes = await fetch(`${KPI_AUTH_URL}/api/user`, {
      method: 'GET',
      headers: {
        Cookie: kpiCookieHeader,
        Accept: 'application/json',
      },
    });

    if (!userRes.ok) {
      console.error('[diia/check] user fetch failed:', userRes.status);
      return Errors.internal('Failed to retrieve user data from provider');
    }

    userData = (await userRes.json()) as KpiUserData;
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

  const studentId = data.STUDENT_ID;
  const fullName = data.NAME;

  if (!studentId || !fullName) {
    return Errors.unauthorized('Incomplete user data returned by provider');
  }

  if (data.EMPLOYEE_ID && !studentId) {
    return Errors.forbidden('Platform is only available for students');
  }

  const auth = await requireAuth(req);
  if (auth.ok) await revokeByAccessJti(auth.user.jti, auth.user.iat);

  const tokenPayload: TokenPayload = {
    sub: studentId,
    faculty: 'TEST',
    group: 'IP-24',
    fullName,
    speciality: undefined,
    studyYear: undefined,
    studyForm: undefined,
  };

  const adminRecord = await prisma.admin.findUnique({
    where: { user_id: studentId, deleted_at: null },
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

  const response = NextResponse.json({
    status: 'success',
    userId: studentId,
    fullName,
    isAdmin,
  });

  response.cookies.set(COOKIE_ACCESS, accessToken, tokenCookieOptions('access'));
  response.cookies.set(COOKIE_REFRESH, refreshToken, tokenCookieOptions('refresh'));

  return response;
}
