import * as allure from 'allure-js-commons';

import { makeTokenPair, USER_PAYLOAD } from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { rateLimitMock, resetRateLimitMock } from '@/__tests__/helpers/rate-limit-mock';
import { getResponseCookie, makeRefreshRequest, makeRequest } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';
import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/constants';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/rate-limit', () => rateLimitMock);

import { POST } from '@/app/api/auth/refresh/route';

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetRateLimitMock();
    allure.feature('Auth');
    allure.story('Token Refresh');
  });

  it('returns 429 when the refresh rate limit is exceeded', async () => {
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

  it('returns 401 when the refresh token cookie is missing', async () => {
    const req = makeRequest({ method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when isRefreshTokenValid returns false (token revoked)', async () => {
    const { refresh } = await makeTokenPair(USER_PAYLOAD);
    tokenStoreMock.isRefreshTokenValid.mockResolvedValueOnce(false);

    const req = makeRefreshRequest(refresh.token, { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects an access token placed in the refresh cookie slot', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    const req = makeRefreshRequest(access.token, { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 for a valid refresh token', async () => {
    const { refresh } = await makeTokenPair(USER_PAYLOAD);
    tokenStoreMock.isRefreshTokenValid.mockResolvedValueOnce(true);
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeRefreshRequest(refresh.token, { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('revokes the old refresh token pair via revokeByRefreshJti', async () => {
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

  it('persists the new token pair via persistTokenPair', async () => {
    const { refresh } = await makeTokenPair(USER_PAYLOAD);
    tokenStoreMock.isRefreshTokenValid.mockResolvedValueOnce(true);
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeRefreshRequest(refresh.token, { method: 'POST' });
    await POST(req);

    expect(tokenStoreMock.persistTokenPair).toHaveBeenCalledTimes(1);
    expect(tokenStoreMock.persistTokenPair).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
    );
  });

  it('sets new access_token and refresh_token cookies', async () => {
    const { refresh } = await makeTokenPair(USER_PAYLOAD);
    tokenStoreMock.isRefreshTokenValid.mockResolvedValueOnce(true);
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeRefreshRequest(refresh.token, { method: 'POST' });
    const res = await POST(req);

    expect(getResponseCookie(res, COOKIE_ACCESS)).not.toBeNull();
    expect(getResponseCookie(res, COOKIE_REFRESH)).not.toBeNull();
  });

  it('re-checks admin status from DB during rotation', async () => {
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
