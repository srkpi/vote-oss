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
  parseStudentClaims,
} from '@/lib/kpi-oidc';
import { completeLogin } from '@/lib/login-session';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

export async function GET(req: NextRequest) {
  let response: NextResponse;
  try {
    const handle = req.cookies.get(OIDC_COOKIE)?.value;
    if (!handle || !/^[a-f0-9]{64}$/.test(handle)) throw new Error('Missing login transaction');
    // Atomically consume the transaction, including on provider cancellation.
    const raw = await redis.getdel(`oidc:${handle}`);
    if (!raw) throw new Error('Expired login transaction');
    const pending = JSON.parse(raw) as { verifier: string; state: string; nonce: string };
    const callbackUrl = new URL(OIDC_CALLBACK);
    callbackUrl.search = req.nextUrl.search;
    const tokens = await oidc.authorizationCodeGrant(await getOidcConfig(), callbackUrl, {
      pkceCodeVerifier: pending.verifier,
      expectedState: pending.state,
      expectedNonce: pending.nonce,
      idTokenExpected: true,
    });
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
    const login = await completeLogin(req, selected, identity.user_id);
    if (!login.ok) throw new Error('Login rejected');
    const { redirectTo } = (await login.json()) as { redirectTo: string };
    response = NextResponse.redirect(new URL(redirectTo, APP_URL));
    for (const cookie of login.cookies.getAll()) response.cookies.set(cookie);
  } catch {
    response = NextResponse.redirect(new URL('/login?error=kpi-id', APP_URL));
  }
  response.cookies.set(OIDC_COOKIE, '', { ...oidcCookieOptions, maxAge: 0 });
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
