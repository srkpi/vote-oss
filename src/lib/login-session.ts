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
import { signAccessToken, signRefreshToken, tokenCookieOptions } from '@/lib/jwt';
import { getCampusUserData } from '@/lib/kpi-id';
import { prisma } from '@/lib/prisma';
import { persistTokenPair, revokeByAccessJti } from '@/lib/token-store';
import type { KpiIdUserInfo, TokenPayload } from '@/types/auth';

export async function completeLogin(
  req: NextRequest,
  kpiIdInfo: KpiIdUserInfo,
  userId = kpiIdInfo.STUDENT_ID,
) {
  // Pre-apply a pending bypass token stored by the proxy when the user was
  // redirected from /use/[token] to /login while unauthenticated.
  // We do this BEFORE getCampusUserData so that the bypass is already in the
  // DB when getUserBypassInfo is called inside getCampusUserData.
  const pendingBypassToken = req.cookies.get(COOKIE_PENDING_BYPASS)?.value;
  let pendingBypassResult: { type: 'GLOBAL' | 'ELECTION'; electionId: string | null } | null = null;
  if (pendingBypassToken) {
    try {
      pendingBypassResult = await applyBypassToken(userId, pendingBypassToken);
    } catch {
      // Token invalid, expired, or limit reached — proceed with normal auth flow.
      // getCampusUserData will still return 403 if the user genuinely can't log in.
    }
  }

  const campusDataResult = await getCampusUserData(kpiIdInfo, userId);
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
    : returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') && !returnTo.includes('\\')
      ? returnTo
      : '/elections';

  const response = NextResponse.json({ redirectTo }, { status: 200 });

  response.cookies.set(COOKIE_ACCESS, accessToken, tokenCookieOptions('access'));
  response.cookies.set(COOKIE_REFRESH, refreshToken, tokenCookieOptions('refresh'));
  response.cookies.set(COOKIE_PENDING_BYPASS, '', { maxAge: 0, path: '/' });
  response.cookies.set(COOKIE_RETURN_TO, '', { maxAge: 0, path: '/' });

  return response;
}
