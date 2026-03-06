import { NextRequest } from 'next/server';
import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/jwt';

export interface MockRequestOptions {
  method?: string;
  body?: unknown;
  cookies?: Record<string, string>;
  searchParams?: Record<string, string>;
  url?: string;
}

/** Build a NextRequest that can be passed directly to route handlers. */
export function makeRequest(options: MockRequestOptions = {}): NextRequest {
  const {
    method = 'GET',
    body,
    cookies = {},
    searchParams = {},
    url = 'http://localhost/api/test',
  } = options;

  const fullUrl = new URL(url);
  Object.entries(searchParams).forEach(([k, v]) => fullUrl.searchParams.set(k, v));

  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

  const headers = new Headers();
  if (cookieHeader) headers.set('cookie', cookieHeader);
  if (body !== undefined) headers.set('content-type', 'application/json');

  return new NextRequest(fullUrl.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** Build a request with access_token cookie already attached. */
export function makeAuthRequest(
  accessToken: string,
  options: MockRequestOptions = {},
): NextRequest {
  return makeRequest({
    ...options,
    cookies: { [COOKIE_ACCESS]: accessToken, ...(options.cookies ?? {}) },
  });
}

/** Build a request with refresh_token cookie already attached. */
export function makeRefreshRequest(
  refreshToken: string,
  options: MockRequestOptions = {},
): NextRequest {
  return makeRequest({
    ...options,
    cookies: { [COOKIE_REFRESH]: refreshToken, ...(options.cookies ?? {}) },
  });
}

/** Parse JSON from a NextResponse returned by a route handler. */
export async function parseJson<T = unknown>(
  response: Response,
): Promise<{ status: number; body: T }> {
  const body = (await response.json()) as T;
  return { status: response.status, body };
}

/** Extract a cookie value from a route response Set-Cookie header. */
export function getResponseCookie(response: Response, name: string): string | null {
  const setCookie = response.headers.getSetCookie?.() ?? [];
  for (const entry of setCookie) {
    const parts = entry.split(';');
    const [key, value] = (parts[0] ?? '').split('=');
    if (key?.trim() === name) return value?.trim() ?? null;
  }
  return null;
}

/** Assert a response cookie is present and return its raw directive string. */
export function getCookieDirectives(
  response: Response,
  name: string,
): Record<string, string | boolean> {
  const setCookie = response.headers.getSetCookie?.() ?? [];
  for (const entry of setCookie) {
    const parts = entry.split(';').map((p) => p.trim());
    const [key] = (parts[0] ?? '').split('=');
    if (key?.trim() !== name) continue;

    const directives: Record<string, string | boolean> = {};
    parts.slice(1).forEach((part) => {
      const [k, v] = part.split('=');
      directives[k!.toLowerCase()] = v ?? true;
    });
    return directives;
  }
  return {};
}
