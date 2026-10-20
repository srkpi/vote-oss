import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import * as oidc from 'openid-client';

import { APP_URL } from '@/lib/config/client';
import {
  getOidcConfig,
  OIDC_CALLBACK,
  OIDC_COOKIE,
  oidcCookieOptions,
  sealOidcTransaction,
} from '@/lib/kpi-oidc';
import { getClientIp, rateLimitLogin } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const limit = await rateLimitLogin(getClientIp(req.headers));
  if (limit.limited)
    return new NextResponse(null, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(limit.resetInMs / 1000)) },
    });
  try {
    const config = await getOidcConfig();
    const verifier = oidc.randomPKCECodeVerifier();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const url = oidc.buildAuthorizationUrl(config, {
      redirect_uri: OIDC_CALLBACK,
      scope: 'openid profile student_ids',
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
      code_challenge_method: 'S256',
      state,
      nonce,
      // A new local session must represent fresh trusted identification.
      prompt: 'login',
    });
    const response = NextResponse.redirect(url);
    response.cookies.set(
      OIDC_COOKIE,
      await sealOidcTransaction({ verifier, state, nonce }),
      oidcCookieOptions,
    );
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    return NextResponse.redirect(new URL('/login?error=kpi-id', APP_URL));
  }
}
