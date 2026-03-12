import { NextRequest, NextResponse } from 'next/server';

import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/constants';
import { type VerifiedPayload, verifyAccessToken, verifyRefreshToken } from '@/lib/jwt';

const PROTECTED_PATHS = ['/elections', '/admin', '/join'];
const GUEST_ONLY_PATHS = ['/auth/login'];
const ADMIN_ONLY_PATHS = ['/admin'];

function parseSetCookie(cookieStr: string): { name: string; value: string } | null {
  const semi = cookieStr.indexOf(';');
  const pair = semi === -1 ? cookieStr : cookieStr.slice(0, semi);
  const eq = pair.indexOf('=');
  if (eq === -1) return null;
  return {
    name: pair.slice(0, eq).trim(),
    value: pair.slice(eq + 1).trim(),
  };
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const isGuestOnly = GUEST_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const isAdminOnly = ADMIN_ONLY_PATHS.some((p) => pathname.startsWith(p));

  const accessCookie = req.cookies.get(COOKIE_ACCESS)?.value;
  const refreshCookie = req.cookies.get(COOKIE_REFRESH)?.value;

  let user: VerifiedPayload | null = null;
  let newSetCookies: string[] = [];

  // ── 1. Try access token (signature only — no DB round-trip) ──────────────
  if (accessCookie) {
    const payload = await verifyAccessToken(accessCookie);
    if (payload?.token_type === 'access') {
      user = payload;
    }
  }

  // ── 2. If no valid access token, attempt a silent refresh ─────────────────
  if (!user && refreshCookie) {
    // Pre-check signature to avoid a useless HTTP call for garbage tokens
    const refreshPayload = await verifyRefreshToken(refreshCookie);
    if (refreshPayload?.token_type === 'refresh') {
      try {
        const refreshRes = await fetch(new URL('/api/auth/refresh', req.nextUrl.origin).href, {
          method: 'POST',
          headers: { cookie: `${COOKIE_REFRESH}=${refreshCookie}` },
        });

        if (refreshRes.ok) {
          user = refreshPayload;

          // Collect Set-Cookie strings so we can forward them to the client and
          // also patch the request cookie header for same-request API calls.
          if (typeof refreshRes.headers.getSetCookie === 'function') {
            newSetCookies = refreshRes.headers.getSetCookie();
          } else {
            // Fallback for environments without getSetCookie()
            const raw = refreshRes.headers.get('set-cookie');
            if (raw) newSetCookies = [raw];
          }
        }
      } catch {
        // Network failure or refresh endpoint error → treat as unauthenticated
      }
    }
  }

  // ── 3. Routing guards ────────────────────────────────────────────────────

  // Non-authenticated user hitting a protected route → login
  if (!user && isProtected) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/auth/login';
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user hitting a guest-only route → elections
  if (user && isGuestOnly) {
    return NextResponse.redirect(new URL('/elections', req.nextUrl.origin));
  }

  // Authenticated non-admin hitting an admin route → elections
  if (user && isAdminOnly && !user.is_admin) {
    return NextResponse.redirect(new URL('/elections', req.nextUrl.origin));
  }

  // Admin hitting /join → they already have admin, send them to admin panel
  if (user && user.is_admin && pathname.startsWith('/join')) {
    return NextResponse.redirect(new URL('/admin', req.nextUrl.origin));
  }

  // ── 4. Build enriched request headers for server components ──────────────

  const requestHeaders = new Headers(req.headers);

  if (user) {
    requestHeaders.set('x-user-id', user.sub);
    requestHeaders.set('x-user-name', user.full_name);
    requestHeaders.set('x-user-faculty', user.faculty);
    requestHeaders.set('x-user-group', user.group);
    requestHeaders.set('x-user-is-admin', String(user.is_admin));
  }

  // ── 5. If tokens were refreshed, patch the cookie header so that
  //       server-component serverFetch() calls use the new access token ──────
  if (newSetCookies.length > 0) {
    let newAccessValue = '';
    let newRefreshValue = '';

    for (const str of newSetCookies) {
      const parsed = parseSetCookie(str);
      if (!parsed) continue;
      if (parsed.name === COOKIE_ACCESS) newAccessValue = parsed.value;
      if (parsed.name === COOKIE_REFRESH) newRefreshValue = parsed.value;
    }

    if (newAccessValue || newRefreshValue) {
      const existingCookies = (req.headers.get('cookie') ?? '')
        .split(';')
        .map((c) => c.trim())
        .filter((c) => !c.startsWith(`${COOKIE_ACCESS}=`) && !c.startsWith(`${COOKIE_REFRESH}=`));

      if (newAccessValue) existingCookies.push(`${COOKIE_ACCESS}=${newAccessValue}`);
      if (newRefreshValue) existingCookies.push(`${COOKIE_REFRESH}=${newRefreshValue}`);

      requestHeaders.set('cookie', existingCookies.join('; '));
    }
  }

  // ── 6. Build final response, forwarding any new Set-Cookie headers ────────

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  for (const cookieStr of newSetCookies) {
    response.headers.append('set-cookie', cookieStr);
  }

  return response;
}

export const config = {
  // Run on all routes except Next.js internals, static assets, and API routes
  // (API routes carry their own requireAuth / requireAdmin guards).
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico|.*\\..*$).*)'],
};
