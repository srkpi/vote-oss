import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { makeTokenPair, USER_PAYLOAD } from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { resetRateLimitMock } from '@/__tests__/helpers/rate-limit-mock';
import { makeRefreshRequest } from '@/__tests__/helpers/request';
import { TEST_NOW } from '@/__tests__/helpers/time';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';

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

const INITIAL_AUTH_AT = Math.floor(TEST_NOW / 1000) - 3600; // 1 hour ago

async function makeRefreshReq(initialAuthAt?: number) {
  const payload = { ...USER_PAYLOAD, ...(initialAuthAt !== undefined ? { initialAuthAt } : {}) };
  const { refresh } = await makeTokenPair(payload);
  tokenStoreMock.isRefreshTokenValid.mockResolvedValueOnce(true);
  prismaMock.admin.findUnique.mockResolvedValueOnce(null);
  return makeRefreshRequest(refresh.token, { method: 'POST' });
}

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetPrismaMock();
  resetTokenStoreMock();
  resetRateLimitMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Renewing the session — global bypass revocation check (POST /api/auth/refresh)', () => {
  beforeEach(() => {
    allure.feature('Auth');
    allure.story('Refresh – Bypass Revocation');
  });

  it('should return 401 when a global bypass usage was revoked after initial_auth_at', async () => {
    const req = await makeRefreshReq(INITIAL_AUTH_AT);

    // Simulate a bypass usage revoked after the user first authenticated
    prismaMock.globalBypassTokenUsage.findFirst.mockResolvedValueOnce({ id: 'usage-1' });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('should include an informative error message when bypass is revoked', async () => {
    const req = await makeRefreshReq(INITIAL_AUTH_AT);
    prismaMock.globalBypassTokenUsage.findFirst.mockResolvedValueOnce({ id: 'usage-1' });

    const res = await POST(req);
    const body = await res.json();
    expect(body.message).toMatch(/revoked/i);
  });

  it('should return 200 when no bypass usages were revoked after initial_auth_at', async () => {
    const req = await makeRefreshReq(INITIAL_AUTH_AT);
    prismaMock.globalBypassTokenUsage.findFirst.mockResolvedValueOnce(null);

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('should skip bypass check entirely when token has no initialAuthAt', async () => {
    // Tokens without initialAuthAt (legacy or admin tokens) are not subject to this check
    const req = await makeRefreshReq(undefined);

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(prismaMock.globalBypassTokenUsage.findFirst).not.toHaveBeenCalled();
  });

  it('should check for global bypass activations revoked after initial sign-in when renewing the session', async () => {
    const req = await makeRefreshReq(INITIAL_AUTH_AT);
    prismaMock.globalBypassTokenUsage.findFirst.mockResolvedValueOnce(null);

    await POST(req);

    expect(prismaMock.globalBypassTokenUsage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: USER_PAYLOAD.sub,
          OR: expect.arrayContaining([
            expect.objectContaining({
              revoked_at: expect.objectContaining({ gt: expect.any(Date) }),
            }),
            expect.objectContaining({
              revoked_at: null,
              token: {
                valid_until: expect.objectContaining({
                  gt: expect.any(Date),
                  lt: expect.any(Date),
                }),
              },
            }),
          ]),
        }),
      }),
    );
  });

  it('should issue replacement session tokens when the global bypass remains valid', async () => {
    const req = await makeRefreshReq(INITIAL_AUTH_AT);
    prismaMock.globalBypassTokenUsage.findFirst.mockResolvedValueOnce(null);

    await POST(req);

    expect(tokenStoreMock.persistTokenPair).toHaveBeenCalledTimes(1);
    expect(tokenStoreMock.revokeByRefreshJti).toHaveBeenCalledTimes(1);
  });

  it('should not check election bypass usages (only global) when renewing the session', async () => {
    const req = await makeRefreshReq(INITIAL_AUTH_AT);
    prismaMock.globalBypassTokenUsage.findFirst.mockResolvedValueOnce(null);

    await POST(req);

    expect(prismaMock.electionBypassTokenUsage.findFirst).not.toHaveBeenCalled();
  });
});
