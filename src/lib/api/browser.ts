'use client';

import { createApiClient } from '@/lib/api/client';
import type { ApiResult } from '@/types/api';

const BASE_URL = '/api';

// Ensures concurrent 401 responses only trigger a single refresh request
// instead of a stampede of parallel refresh calls.
let _refreshing: Promise<boolean> | null = null;

async function _doRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.ok;
  } catch {
    return false;
  }
}

function triggerRefresh(): Promise<boolean> {
  if (!_refreshing) {
    _refreshing = _doRefresh().finally(() => {
      _refreshing = null;
    });
  }
  return _refreshing;
}

async function rawFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers instanceof Headers
          ? Object.fromEntries(options.headers.entries())
          : options.headers || {}),
      },
      ...options,
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
      error: err instanceof Error ? err.message : 'Помилка мережі',
      status: 0,
    };
  }
}

/**
 * Fetch with automatic token refresh.
 * On a 401, attempts one silent refresh then retries.
 * If the refresh also fails the user is redirected to /login.
 */
async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const result = await rawFetch<T>(path, options);

  if (result.success || result.status !== 401 || path === '/auth/kpi-id') {
    return result;
  }

  if (path === '/auth/refresh') {
    return result;
  }

  const refreshed = await triggerRefresh();

  if (refreshed) {
    return rawFetch<T>(path, options);
  }

  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }

  return {
    success: false,
    data: null,
    error: 'Сесія закінчилась. Будь ласка, увійдіть знову.',
    status: 401,
  };
}

export const api = createApiClient(fetchApi);
