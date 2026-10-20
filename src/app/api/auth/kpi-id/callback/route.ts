import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import * as oidc from 'openid-client';

import { APP_URL } from '@/lib/config/client';
import { getCampusUserData } from '@/lib/kpi-id';
import {
  getOidcConfig,
  OIDC_CALLBACK,
  OIDC_COOKIE,
  oidcCookieOptions,
  openOidcTransaction,
  parseStudentClaims,
} from '@/lib/kpi-oidc';
import { completeLogin } from '@/lib/login-session';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  let response: NextResponse;
  let clearTransaction = true;
  try {
    const pending = await openOidcTransaction(req.cookies.get(OIDC_COOKIE)?.value);
    // A forged callback must not cancel this browser's legitimate sign-in.
    clearTransaction = false;
    const callbackUrl = new URL(OIDC_CALLBACK);
    callbackUrl.search = req.nextUrl.search;
    const tokens = await oidc.authorizationCodeGrant(await getOidcConfig(), callbackUrl, {
      pkceCodeVerifier: pending.verifier,
      expectedState: pending.state,
      expectedNonce: pending.nonce,
      idTokenExpected: true,
    });
    // The provider enforces one-time code use; clear the browser transaction too.
    clearTransaction = true;
    const claims = tokens.claims();
    if (!claims) throw new Error('Missing ID token');
    const { subject, students } = parseStudentClaims(claims);
    const existing = await prisma.kpiIdentity.findUnique({ where: { subject } });
    // Prefer an existing account's student record; otherwise try each record
    // for current campus eligibility (e.g. master's after bachelor's).
    students.sort(
      (a, b) =>
        Number(b.STUDENT_ID === existing?.user_id) - Number(a.STUDENT_ID === existing?.user_id),
    );
    let selected;
    for (const student of students) {
      const campus = await getCampusUserData(student, existing?.user_id ?? student.STUDENT_ID);
      if (!(campus instanceof NextResponse)) {
        selected = student;
        break;
      }
    }
    // Let completeLogin apply a pending bypass before the final eligibility check.
    selected ??= students[0];
    const identity = await prisma.kpiIdentity.upsert({
      where: { subject },
      update: {},
      create: { subject, user_id: selected.STUDENT_ID },
    });
    response = await completeLogin(req, selected, { userId: identity.user_id, redirect: true });
    if (response.status >= 400) throw new Error('Login rejected');
  } catch (error) {
    // This error is returned only after the library validates issuer and state.
    if (error instanceof oidc.AuthorizationResponseError) clearTransaction = true;
    response = NextResponse.redirect(new URL('/login?error=kpi-id', APP_URL));
  }
  if (clearTransaction) response.cookies.set(OIDC_COOKIE, '', { ...oidcCookieOptions, maxAge: 0 });
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
