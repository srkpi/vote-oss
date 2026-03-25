import { type NextRequest, NextResponse } from 'next/server';

import { APP_URL } from '@/lib/config/client';
import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/constants';
import { verifyAccessToken, verifyRefreshToken } from '@/lib/jwt';
import type { VerifiedPayload } from '@/types/auth';

const PROTECTED_PATHS = ['/elections', '/admin', '/join'];
const GUEST_ONLY_PATHS = ['/login'];
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

  // Try access token (signature only — no DB round-trip)
  if (accessCookie) {
    try {
      const payload = await verifyAccessToken(accessCookie);
      if (payload?.tokenType === 'access') {
        user = payload;
      }
    } catch {
      // Invalid token → try refresh or treat as unauthenticated
    }
  }

  // If no valid access token, attempt a silent refresh
  if (!user && refreshCookie) {
    // Pre-check signature to avoid a useless HTTP call for garbage tokens
    try {
      const refreshPayload = await verifyRefreshToken(refreshCookie);
      if (refreshPayload?.tokenType === 'refresh') {
        const refreshRes = await fetch(`${APP_URL}/api/auth/refresh`, {
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
      }
    } catch {
      // Network failure or refresh endpoint error → treat as unauthenticated
    }
  }

  // Non-authenticated user hitting a protected route
  if (!user && isProtected) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user hitting a guest-only route
  if (user && isGuestOnly) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
  }

  // Authenticated non-admin hitting an admin route
  if (user && isAdminOnly && !user.isAdmin) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
  }

  // Admin hitting /join → they already have admin, send them to admin panel
  if (user && user.isAdmin && pathname.startsWith('/join')) {
    return NextResponse.redirect(new URL('/admin', req.nextUrl.origin));
  }

  // Build enriched request headers for server components
  const requestHeaders = new Headers(req.headers);
  if (user) {
    requestHeaders.set('x-user-id', user.sub);
    requestHeaders.set('x-user-name', Buffer.from(user.fullName, 'utf8').toString('base64'));
    requestHeaders.set('x-user-faculty', Buffer.from(user.faculty, 'utf8').toString('base64'));
    requestHeaders.set('x-user-group', Buffer.from(user.group, 'utf8').toString('base64'));
    requestHeaders.set('x-user-is-admin', String(user.isAdmin));

    if (user.isAdmin) {
      requestHeaders.set('x-user-restricted-to-facutly', String(user.restrictedToFaculty ?? true));
      requestHeaders.set('x-user-manage-admins', String(user.manageAdmins ?? false));
    }
  }

  // If tokens were refreshed, patch the cookie header so that
  // server-component serverFetch() calls use the new access token
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

  // Build final response, forwarding any new Set-Cookie headers
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
