import * as allure from 'allure-js-commons';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { makeRequest, makeAuthRequest, parseJson } from '../../helpers/request';
import { makeTokenPair, USER_PAYLOAD, JWT_TOKEN_RECORD } from '../../helpers/fixtures';
import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/jwt';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { POST } from '@/app/api/auth/logout/route';

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    resetPrismaMock();
    allure.feature('Auth');
    allure.story('Logout');
  });

  it('returns 401 when no access token cookie is present', async () => {
    const req = makeRequest({ method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 for a revoked access token', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(null);
    const req = makeAuthRequest(access.token, { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 on successful logout', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });

    const req = makeAuthRequest(access.token, { method: 'POST' });
    const res = await POST(req);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('deletes the token pair by access_jti', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });

    const req = makeAuthRequest(access.token, { method: 'POST' });
    await POST(req);

    expect(prismaMock.jwtToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { access_jti: access.jti } }),
    );
  });

  it('clears access_token cookie (maxAge=0)', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });

    const req = makeAuthRequest(access.token, { method: 'POST' });
    const res = await POST(req);

    // Cookie cleared means it's set with an empty value or maxAge=0
    const setCookies = res.headers.getSetCookie?.() ?? [];
    const accessClearEntry = setCookies.find((c) => c.startsWith(`${COOKIE_ACCESS}=`));
    expect(accessClearEntry).toBeDefined();
    expect(accessClearEntry).toMatch(/max-age=0/i);
  });

  it('clears refresh_token cookie (maxAge=0)', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });

    const req = makeAuthRequest(access.token, { method: 'POST' });
    const res = await POST(req);

    const setCookies = res.headers.getSetCookie?.() ?? [];
    const refreshClearEntry = setCookies.find((c) => c.startsWith(`${COOKIE_REFRESH}=`));
    expect(refreshClearEntry).toBeDefined();
    expect(refreshClearEntry).toMatch(/max-age=0/i);
  });
});
