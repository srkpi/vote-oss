import * as allure from 'allure-js-commons';

import { makeTokenPair, USER_PAYLOAD } from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { rateLimitMock, resetRateLimitMock } from '@/__tests__/helpers/rate-limit-mock';
import { makeRefreshRequest } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/rate-limit', () => rateLimitMock);

import { POST } from '@/app/api/auth/refresh/route';

const INITIAL_AUTH_AT = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

async function makeRefreshReq(initialAuthAt?: number) {
  const payload = { ...USER_PAYLOAD, ...(initialAuthAt !== undefined ? { initialAuthAt } : {}) };
  const { refresh } = await makeTokenPair(payload);
  tokenStoreMock.isRefreshTokenValid.mockResolvedValueOnce(true);
  prismaMock.admin.findUnique.mockResolvedValueOnce(null);
  return makeRefreshRequest(refresh.token, { method: 'POST' });
}

describe('POST /api/auth/refresh — global bypass revocation check', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetRateLimitMock();
    allure.feature('Auth');
    allure.story('Refresh – Bypass Revocation');
  });

  it('returns 401 when a global bypass usage was revoked after initial_auth_at', async () => {
    const req = await makeRefreshReq(INITIAL_AUTH_AT);

    // Simulate a bypass usage revoked after the user first authenticated
    prismaMock.globalBypassTokenUsage.findFirst.mockResolvedValueOnce({ id: 'usage-1' });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('includes an informative error message when bypass is revoked', async () => {
    const req = await makeRefreshReq(INITIAL_AUTH_AT);
    prismaMock.globalBypassTokenUsage.findFirst.mockResolvedValueOnce({ id: 'usage-1' });

    const res = await POST(req);
    const body = await res.json();
    expect(body.message).toMatch(/revoked/i);
  });

  it('returns 200 when no bypass usages were revoked after initial_auth_at', async () => {
    const req = await makeRefreshReq(INITIAL_AUTH_AT);
    prismaMock.globalBypassTokenUsage.findFirst.mockResolvedValueOnce(null);

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('skips bypass check entirely when token has no initialAuthAt', async () => {
    // Tokens without initialAuthAt (legacy or admin tokens) are not subject to this check
    const req = await makeRefreshReq(undefined);

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(prismaMock.globalBypassTokenUsage.findFirst).not.toHaveBeenCalled();
  });

  it('queries globalBypassTokenUsage with correct filters', async () => {
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

  it('still issues new tokens when bypass check passes', async () => {
    const req = await makeRefreshReq(INITIAL_AUTH_AT);
    prismaMock.globalBypassTokenUsage.findFirst.mockResolvedValueOnce(null);

    await POST(req);

    expect(tokenStoreMock.persistTokenPair).toHaveBeenCalledTimes(1);
    expect(tokenStoreMock.revokeByRefreshJti).toHaveBeenCalledTimes(1);
  });

  it('does NOT check election bypass usages (only global)', async () => {
    const req = await makeRefreshReq(INITIAL_AUTH_AT);
    prismaMock.globalBypassTokenUsage.findFirst.mockResolvedValueOnce(null);

    await POST(req);

    expect(prismaMock.electionBypassTokenUsage.findFirst).not.toHaveBeenCalled();
  });
});
