'use server';

import { cookies, headers } from 'next/headers';

import type { User } from '@/types/auth';

export async function getServerSession(): Promise<User | null> {
  const h = await headers();
  const userId = h.get('x-user-id');
  if (!userId) return null;

  const isAdmin = h.get('x-user-is-admin') === 'true';

  return {
    userId,
    fullName: h.get('x-user-name') ?? '',
    faculty: h.get('x-user-faculty') ?? '',
    group: h.get('x-user-group') ?? '',
    isAdmin,
    restrictedToFaculty: !isAdmin || h.get('x-user-restricted-to-faculty') === 'true',
    manageAdmins: isAdmin && h.get('x-user-manage-admins') === 'true',
  };
}

export async function serverFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T | null; error: string | null; status: number }> {
  const cookieStore = await cookies();
  const cookieParts: string[] = [];
  const access = cookieStore.get('access_token')?.value;
  const refresh = cookieStore.get('refresh_token')?.value;

  if (access) {
    cookieParts.push(`access_token=${access}`);
  }

  if (refresh) {
    cookieParts.push(`refresh_token=${refresh}`);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(cookieParts.length > 0 ? { Cookie: cookieParts.join('; ') } : {}),
        ...(options.headers ?? {}),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const body = (await response.json()) as { message?: string };
        errorMessage = body.message ?? errorMessage;
      } catch {
        // ignore parse errors
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
