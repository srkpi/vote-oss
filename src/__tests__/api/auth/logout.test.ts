import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { makeTokenPair, USER_PAYLOAD } from '@/__tests__/helpers/fixtures';
import { resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRequest } from '@/__tests__/helpers/request';
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

import { POST } from '@/app/api/auth/logout/route';

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetPrismaMock();
  resetTokenStoreMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Signing out (POST /api/auth/logout)', () => {
  beforeEach(() => {
    allure.feature('Auth');
    allure.story('Logout');
  });

  it('should return 401 when no access token cookie is present', async () => {
    const req = makeRequest({ method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('should return 401 when isAccessTokenValid returns false (token revoked)', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(false);

    const req = makeAuthRequest(access.token, { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('should return 401 for a malformed access token when signing out', async () => {
    const req = makeAuthRequest('bad.token', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('should confirm sign-out with 200 when the active session is revoked', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);

    const req = makeAuthRequest(access.token, { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('should revoke the authenticated session when the user signs out', async () => {
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

  it('should expire the access-token cookie after successful sign-out', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);

    const req = makeAuthRequest(access.token, { method: 'POST' });
    const res = await POST(req);

    const setCookies = res.headers.getSetCookie?.() ?? [];
    const clearEntry = setCookies.find((c) => c.startsWith(`${COOKIE_ACCESS}=`));
    expect(clearEntry).toBeDefined();
    expect(clearEntry).toMatch(/max-age=0/i);
  });

  it('should expire the refresh-token cookie after successful sign-out', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);

    const req = makeAuthRequest(access.token, { method: 'POST' });
    const res = await POST(req);

    const setCookies = res.headers.getSetCookie?.() ?? [];
    const clearEntry = setCookies.find((c) => c.startsWith(`${COOKIE_REFRESH}=`));
    expect(clearEntry).toBeDefined();
    expect(clearEntry).toMatch(/max-age=0/i);
  });

  it('should leave sessions unchanged when sign-out authentication fails', async () => {
    const req = makeRequest({ method: 'POST' });
    await POST(req);
    expect(tokenStoreMock.revokeByAccessJti).not.toHaveBeenCalled();
  });
});
