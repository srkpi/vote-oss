import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { makeTokenPair, USER_PAYLOAD } from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { rateLimitMock, resetRateLimitMock } from '@/__tests__/helpers/rate-limit-mock';
import { getResponseCookie, makeRefreshRequest, makeRequest } from '@/__tests__/helpers/request';
import { TEST_NOW } from '@/__tests__/helpers/time';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';
import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/constants';

vi.mock('@/lib/prisma', async () => {
  const { prismaMock } = await import('@/__tests__/helpers/prisma-mock');
  return { prisma: prismaMock };
});
vi.mock('@/lib/token-store', async () => {
  const { tokenStoreMock } = await import('@/__tests__/helpers/token-store-mock');
  return tokenStoreMock;
});
vi.mock('@/lib/rate-limit', async () => {
  const { rateLimitMock } = await import('@/__tests__/helpers/rate-limit-mock');
  return rateLimitMock;
});

import { POST } from '@/app/api/auth/refresh/route';

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetPrismaMock();
  resetTokenStoreMock();
  resetRateLimitMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Renewing the session (POST /api/auth/refresh)', () => {
  beforeEach(() => {
    allure.feature('Auth');
    allure.story('Token Refresh');
  });

  it('should return 429 when the refresh rate limit is exceeded', async () => {
    rateLimitMock.rateLimitRefresh.mockResolvedValueOnce({
      limited: true,
      remaining: 0,
      resetInMs: 30_000,
    });
    const req = makeRequest({ method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');
  });

  it('should return 401 when the refresh token cookie is missing', async () => {
    const req = makeRequest({ method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('should return 401 when isRefreshTokenValid returns false (token revoked)', async () => {
    const { refresh } = await makeTokenPair(USER_PAYLOAD);
    tokenStoreMock.isRefreshTokenValid.mockResolvedValueOnce(false);

    const req = makeRefreshRequest(refresh.token, { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('should reject an access token placed in the refresh cookie slot when renewing the session', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    const req = makeRefreshRequest(access.token, { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('should return 200 for a valid refresh token when renewing the session', async () => {
    const { refresh } = await makeTokenPair(USER_PAYLOAD);
    tokenStoreMock.isRefreshTokenValid.mockResolvedValueOnce(true);
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeRefreshRequest(refresh.token, { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('should revoke the old session tokens when renewing the session', async () => {
    const { refresh } = await makeTokenPair(USER_PAYLOAD);
    tokenStoreMock.isRefreshTokenValid.mockResolvedValueOnce(true);
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeRefreshRequest(refresh.token, { method: 'POST' });
    await POST(req);

    expect(tokenStoreMock.revokeByRefreshJti).toHaveBeenCalledWith(
      refresh.jti,
      expect.any(Number), // iat
    );
  });

  it('should save the replacement session tokens when renewal succeeds', async () => {
    const { refresh } = await makeTokenPair(USER_PAYLOAD);
    tokenStoreMock.isRefreshTokenValid.mockResolvedValueOnce(true);
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeRefreshRequest(refresh.token, { method: 'POST' });
    await POST(req);

    expect(tokenStoreMock.persistTokenPair).toHaveBeenCalledTimes(1);
    expect(tokenStoreMock.persistTokenPair).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(Date),
    );
  });

  it('should replace both session cookies after successful session renewal', async () => {
    const { refresh } = await makeTokenPair(USER_PAYLOAD);
    tokenStoreMock.isRefreshTokenValid.mockResolvedValueOnce(true);
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeRefreshRequest(refresh.token, { method: 'POST' });
    const res = await POST(req);

    expect(getResponseCookie(res, COOKIE_ACCESS)).not.toBeNull();
    expect(getResponseCookie(res, COOKIE_REFRESH)).not.toBeNull();
  });

  it('should refresh admin permissions from current records when renewing the session', async () => {
    const { refresh } = await makeTokenPair(USER_PAYLOAD);
    tokenStoreMock.isRefreshTokenValid.mockResolvedValueOnce(true);
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeRefreshRequest(refresh.token, { method: 'POST' });
    await POST(req);

    expect(prismaMock.admin.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: USER_PAYLOAD.sub, deleted_at: null } }),
    );
  });
});
