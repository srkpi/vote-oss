'use server';

import { cookies } from 'next/headers';
import {
  verifyAccessToken,
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
  tokenCookieOptions,
  COOKIE_ACCESS,
  COOKIE_REFRESH,
} from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import type { User } from '@/types';

function toUser(payload: {
  sub: string;
  faculty: string;
  group: string;
  full_name: string;
  is_admin: boolean;
}): User {
  return {
    userId: payload.sub,
    faculty: payload.faculty,
    group: payload.group,
    fullName: payload.full_name,
    isAdmin: payload.is_admin,
  };
}

async function tryAccessToken(token: string): Promise<User | null> {
  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return null;
  }

  const record = await prisma.jwtToken.findFirst({
    where: { access_jti: payload.jti },
  });

  if (!record) return null;

  return toUser(payload);
}

async function tryRefreshToken(refreshToken: string): Promise<User | null> {
  let payload;
  try {
    payload = await verifyRefreshToken(refreshToken);
  } catch {
    return null;
  }

  const record = await prisma.jwtToken.findFirst({
    where: { refresh_jti: payload.jti },
  });

  if (!record) return null;

  await prisma.jwtToken.deleteMany({ where: { refresh_jti: payload.jti } });

  const adminRecord = await prisma.admin.findUnique({
    where: { user_id: payload.sub },
  });

  const newPayload = {
    sub: payload.sub,
    faculty: payload.faculty,
    group: payload.group,
    full_name: payload.full_name,
    is_admin: !!adminRecord,
    restricted_to_faculty: adminRecord?.restricted_to_faculty ?? false,
    manage_admins: adminRecord?.manage_admins ?? false,
  };

  const [{ token: newAccess, jti: accessJti }, { token: newRefresh, jti: refreshJti }] =
    await Promise.all([signAccessToken(newPayload), signRefreshToken(newPayload)]);

  await prisma.jwtToken.create({
    data: { access_jti: accessJti, refresh_jti: refreshJti, created_at: new Date() },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_ACCESS, newAccess, tokenCookieOptions('access'));
  cookieStore.set(COOKIE_REFRESH, newRefresh, tokenCookieOptions('refresh'));

  return toUser(newPayload);
}

export async function getServerSession(): Promise<User | null> {
  const cookieStore = await cookies();

  const accessToken = cookieStore.get(COOKIE_ACCESS)?.value;
  if (accessToken) {
    const user = await tryAccessToken(accessToken);
    if (user) return user;
  }

  const refreshTokenValue = cookieStore.get(COOKIE_REFRESH)?.value;
  if (refreshTokenValue) {
    return tryRefreshToken(refreshTokenValue);
  }

  return null;
}

export async function requireServerSession(): Promise<User> {
  const session = await getServerSession();
  if (!session) throw new Error('UNAUTHORIZED');
  return session;
}

export async function getAuthHeaders(): Promise<HeadersInit> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;
  const refreshToken = cookieStore.get('refresh_token')?.value;

  const cookieParts: string[] = [];
  if (accessToken) cookieParts.push(`access_token=${accessToken}`);
  if (refreshToken) cookieParts.push(`refresh_token=${refreshToken}`);

  return cookieParts.length > 0 ? { Cookie: cookieParts.join('; ') } : {};
}

export async function serverFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T | null; error: string | null; status: number }> {
  const headers = await getAuthHeaders();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...(options.headers || {}),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorBody = (await response.json()) as { message?: string };
        errorMessage = errorBody.message || errorMessage;
      } catch {
        // ignore parse error
      }
      return { data: null, error: errorMessage, status: response.status };
    }

    const data = (await response.json()) as T;
    return { data, error: null, status: response.status };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Network error',
      status: 0,
    };
  }
}
