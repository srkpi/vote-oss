import * as allure from 'allure-js-commons';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { makeTokenPair, USER_PAYLOAD } from '@/__tests__/helpers/fixtures';
import { resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRequest } from '@/__tests__/helpers/request';
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

import { POST } from '@/app/api/auth/logout/route';

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    allure.feature('Auth');
    allure.story('Logout');
  });

  it('returns 401 when no access token cookie is present', async () => {
    const req = makeRequest({ method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when isAccessTokenValid returns false (token revoked)', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(false);

    const req = makeAuthRequest(access.token, { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 for a malformed access token', async () => {
    const req = makeAuthRequest('bad.token', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 on successful logout', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);

    const req = makeAuthRequest(access.token, { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('calls revokeByAccessJti with the jti and iat from the token', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);

    const req = makeAuthRequest(access.token, { method: 'POST' });
    await POST(req);

    expect(tokenStoreMock.revokeByAccessJti).toHaveBeenCalledTimes(1);
    expect(tokenStoreMock.revokeByAccessJti).toHaveBeenCalledWith(
      access.jti,
      expect.any(Number), // iat
    );
  });

  it('clears the access_token cookie (maxAge=0)', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);

    const req = makeAuthRequest(access.token, { method: 'POST' });
    const res = await POST(req);

    const setCookies = res.headers.getSetCookie?.() ?? [];
    const clearEntry = setCookies.find((c) => c.startsWith(`${COOKIE_ACCESS}=`));
    expect(clearEntry).toBeDefined();
    expect(clearEntry).toMatch(/max-age=0/i);
  });

  it('clears the refresh_token cookie (maxAge=0)', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);

    const req = makeAuthRequest(access.token, { method: 'POST' });
    const res = await POST(req);

    const setCookies = res.headers.getSetCookie?.() ?? [];
    const clearEntry = setCookies.find((c) => c.startsWith(`${COOKIE_REFRESH}=`));
    expect(clearEntry).toBeDefined();
    expect(clearEntry).toMatch(/max-age=0/i);
  });

  it('does NOT call revokeByAccessJti when auth fails', async () => {
    const req = makeRequest({ method: 'POST' });
    await POST(req);
    expect(tokenStoreMock.revokeByAccessJti).not.toHaveBeenCalled();
  });
});
