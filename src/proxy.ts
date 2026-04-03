import { type NextRequest, NextResponse } from 'next/server';

import { APP_URL } from '@/lib/config/client';
import {
  COOKIE_ACCESS,
  COOKIE_PENDING_BYPASS,
  COOKIE_REFRESH,
  COOKIE_RETURN_TO,
  RETURN_COOKIE_TTL_SECS,
} from '@/lib/constants';
import { verifyAccessToken, verifyRefreshToken } from '@/lib/jwt';
import type { VerifiedPayload } from '@/types/auth';

const PROTECTED_PATHS = ['/elections', '/admin', '/join', '/use'];
const GUEST_ONLY_PATHS = ['/login'];
const ADMIN_ONLY_PATHS = ['/admin'];

function parseSetCookie(cookieStr: string): { name: string; value: string } | null {
  const semi = cookieStr.indexOf(';');
  const pair = semi === -1 ? cookieStr : cookieStr.slice(0, semi);
  const eq = pair.indexOf('=');
  if (eq === -1) return null;
  return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim() };
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

  if (accessCookie) {
    try {
      const payload = await verifyAccessToken(accessCookie);
      if (payload?.tokenType === 'access') user = payload;
    } catch {
      // invalid token
    }
  }

  if (!user && refreshCookie) {
    try {
      const refreshPayload = await verifyRefreshToken(refreshCookie);
      if (refreshPayload?.tokenType === 'refresh') {
        const refreshRes = await fetch(`${APP_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { cookie: `${COOKIE_REFRESH}=${refreshCookie}` },
        });

        if (refreshRes.ok) {
          user = refreshPayload;
          if (typeof refreshRes.headers.getSetCookie === 'function') {
            newSetCookies = refreshRes.headers.getSetCookie();
          } else {
            const raw = refreshRes.headers.get('set-cookie');
            if (raw) newSetCookies = [raw];
          }
        }
      }
    } catch {
      // network failure
    }
  }

  if (!user && isProtected) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';

    // Store the requested path so we can redirect back after login
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(COOKIE_RETURN_TO, pathname + req.nextUrl.search, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: RETURN_COOKIE_TTL_SECS,
    });

    if (pathname.startsWith('/use/')) {
      const bypassToken = pathname.slice('/use/'.length);
      if (bypassToken) {
        response.cookies.set(COOKIE_PENDING_BYPASS, bypassToken, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: RETURN_COOKIE_TTL_SECS,
        });
      }
    }

    return response;
  }

  if (user && isGuestOnly) {
    // After login, redirect to the stored return_to URL if present
    const returnTo = req.cookies.get(COOKIE_RETURN_TO)?.value;
    const targetUrl = returnTo && returnTo.startsWith('/') ? returnTo : '/';
    const response = NextResponse.redirect(new URL(targetUrl, req.nextUrl.origin));
    // Clear the return_to cookie
    response.cookies.set(COOKIE_RETURN_TO, '', { maxAge: 0, path: '/' });
    return response;
  }

  if (user && isAdminOnly && !user.isAdmin)
    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
  if (user && user.isAdmin && pathname.startsWith('/join'))
    return NextResponse.redirect(new URL('/admin', req.nextUrl.origin));

  const requestHeaders = new Headers(req.headers);
  if (user) {
    requestHeaders.set('x-user-id', user.sub);
    requestHeaders.set('x-user-name', Buffer.from(user.fullName, 'utf8').toString('base64'));
    requestHeaders.set('x-user-faculty', Buffer.from(user.faculty, 'utf8').toString('base64'));
    requestHeaders.set('x-user-group', Buffer.from(user.group, 'utf8').toString('base64'));
    requestHeaders.set('x-user-is-admin', String(user.isAdmin));

    if (user.speciality) {
      requestHeaders.set(
        'x-user-speciality',
        Buffer.from(user.speciality, 'utf8').toString('base64'),
      );
    }
    if (user.studyYear != null) {
      requestHeaders.set('x-user-study-year', String(user.studyYear));
    }
    if (user.studyForm) {
      requestHeaders.set(
        'x-user-study-form',
        Buffer.from(user.studyForm, 'utf8').toString('base64'),
      );
    }

    if (user.isAdmin) {
      requestHeaders.set('x-user-restricted-to-faculty', String(user.restrictedToFaculty ?? true));
      requestHeaders.set('x-user-manage-admins', String(user.manageAdmins ?? false));
    }
  }

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
