import { cookies } from 'next/headers';

import { createApiClient } from '@/lib/api/client';
import { APP_URL } from '@/lib/config/client';
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

    const contentType = response.headers.get('content-type');
    const hasBody =
      response.status !== 204 &&
      response.status !== 205 &&
      response.headers.get('content-length') !== '0';

    let parsedData: unknown = null;
    if (hasBody) {
      if (contentType?.includes('application/json')) {
        parsedData = await response.json();
      } else {
        parsedData = await response.text();
      }
    }

    if (!response.ok) {
      let errorMessage = `Сталася помилка (${response.status})`;
      if (
        parsedData &&
        typeof parsedData === 'object' &&
        'message' in parsedData &&
        typeof parsedData.message === 'string'
      ) {
        errorMessage = parsedData?.message;
      }

      return { success: false, data: null, error: errorMessage, status: response.status };
    }

    return { success: true, data: parsedData as T, error: null, status: response.status };
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
