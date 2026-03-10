import * as allure from 'allure-js-commons';

import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/jwt';

import { JWT_TOKEN_RECORD, makeTokenPair, USER_PAYLOAD } from '../../helpers/fixtures';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import {
  getResponseCookie,
  makeRefreshRequest,
  makeRequest,
  parseJson,
} from '../../helpers/request';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { POST } from '@/app/api/auth/refresh/route';

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    resetPrismaMock();
    allure.feature('Auth');
    allure.story('Token Refresh');
  });

  it('returns 401 when refresh cookie is missing', async () => {
    const req = makeRequest({ method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when refresh token is revoked', async () => {
    const { refresh } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(null);
    const req = makeRefreshRequest(refresh.token, { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 and issues new tokens for a valid refresh token', async () => {
    const { refresh } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.jwtToken.create.mockResolvedValueOnce({});

    const req = makeRefreshRequest(refresh.token, { method: 'POST' });
    const res = await POST(req);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('deletes the old token pair (rotation)', async () => {
    const { refresh } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.jwtToken.create.mockResolvedValueOnce({});

    const req = makeRefreshRequest(refresh.token, { method: 'POST' });
    await POST(req);

    expect(prismaMock.jwtToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { refresh_jti: refresh.jti } }),
    );
  });

  it('sets new access_token and refresh_token cookies', async () => {
    const { refresh } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.jwtToken.create.mockResolvedValueOnce({});

    const req = makeRefreshRequest(refresh.token, { method: 'POST' });
    const res = await POST(req);

    expect(getResponseCookie(res, COOKIE_ACCESS)).not.toBeNull();
    expect(getResponseCookie(res, COOKIE_REFRESH)).not.toBeNull();
  });

  it('rejects an access token used in the refresh cookie slot', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    const req = makeRefreshRequest(access.token, { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
