import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { KPI_AUTH_URL } from '@/lib/config/client';
import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/constants';
import { Errors } from '@/lib/errors';
import { parseGroupLevel } from '@/lib/group-utils';
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
    GROUP?: string;
    FACULTY?: string;
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
 *   post:
 *     summary: Poll Diia authentication status
 *     description: >
 *       Checks whether the user has scanned and approved the Diia QR code.
 *       Returns `{ status: "processing" }` while waiting. When the user
 *       completes Diia verification this endpoint exchanges the sessionId for
 *       KPI-ID session cookies, fetches the authenticated user profile, and
 *       issues a new JWT access + refresh token pair via HTTP-only cookies.
 *       Graduate users are rejected with 403.
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

  // In production GROUP comes from the KPI API; mocked for development
  const group = data.GROUP ?? 'IP-24';

  // Graduate students are not permitted to use the platform
  if (parseGroupLevel(group) === 'g') {
    return Errors.forbidden('Platform is not available for graduate students');
  }

  const auth = await requireAuth(req);
  if (auth.ok) await revokeByAccessJti(auth.user.jti, auth.user.iat);

  const faculty = data.FACULTY ?? 'TEST';

  const tokenPayload: TokenPayload = {
    sub: studentId,
    faculty,
    group,
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

  const response = NextResponse.json({ status: 'success' });

  response.cookies.set(COOKIE_ACCESS, accessToken, tokenCookieOptions('access'));
  response.cookies.set(COOKIE_REFRESH, refreshToken, tokenCookieOptions('refresh'));

  return response;
}
