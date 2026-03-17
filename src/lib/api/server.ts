import { cookies } from 'next/headers';

import { createApiClient } from '@/lib/api/client';
import { APP_URL } from '@/lib/config/server';
import type { ApiResult } from '@/types/api';

const BASE_URL = `${APP_URL}/api`;

async function serverFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
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

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
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
      return { success: false, data: null, error: errorMessage, status: response.status };
    }

    const data = (await response.json()) as T;
    return { success: true, data, error: null, status: response.status };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : 'Network error',
      status: 0,
    };
  }
}

export const serverApi = createApiClient(serverFetch);
