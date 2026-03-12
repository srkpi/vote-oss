import * as allure from 'allure-js-commons';

import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/constants';

import { makeTokenPair, USER_PAYLOAD } from '../../helpers/fixtures';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '../../helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '../../helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);

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

  it('returns 200 with ok=true on successful logout', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);

    const req = makeAuthRequest(access.token, { method: 'POST' });
    const res = await POST(req);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
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
