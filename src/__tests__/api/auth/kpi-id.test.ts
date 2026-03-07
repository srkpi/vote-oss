import * as allure from 'allure-js-commons';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import {
  makeRequest,
  parseJson,
  getResponseCookie,
  getCookieDirectives,
} from '../../helpers/request';
import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/jwt';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { POST } from '@/app/api/auth/kpi-id/route';

describe('POST /api/auth/kpi-id', () => {
  beforeEach(() => {
    resetPrismaMock();
    allure.feature('Auth');
    allure.story('KPI ID Login');
  });

  it('returns 400 when body is not valid JSON', async () => {
    const req = makeRequest({ method: 'POST' });
    // Override json() to throw
    req.json = jest.fn().mockRejectedValueOnce(new Error('bad json'));
    const res = await POST(req);
    const { status } = await parseJson(res);
    expect(status).toBe(400);
  });

  it('returns 400 when ticketId is missing from body', async () => {
    const req = makeRequest({ method: 'POST', body: {} });
    const res = await POST(req);
    const { status, body } = await parseJson<any>(res);
    expect(status).toBe(400);
    expect(body.message).toMatch(/ticketId/i);
  });

  it('returns 400 when ticketId is not a string', async () => {
    const req = makeRequest({ method: 'POST', body: { ticketId: 123 } });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 401 when ticketId is unknown', async () => {
    const req = makeRequest({ method: 'POST', body: { ticketId: 'no-such-ticket' } });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with user info for a valid ticket', async () => {
    prismaMock.jwtToken.create.mockResolvedValueOnce({});
    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } });
    const res = await POST(req);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body.userId).toBe('user-001');
    expect(body.fullName).toBe('Ivan Petrenko');
    expect(body.isAdmin).toBe(false);
    expect(body.faculty).toBe('FICS');
  });

  it('sets HTTPOnly access_token and refresh_token cookies', async () => {
    prismaMock.jwtToken.create.mockResolvedValueOnce({});
    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } });
    const res = await POST(req);

    expect(getResponseCookie(res, COOKIE_ACCESS)).not.toBeNull();
    expect(getResponseCookie(res, COOKIE_REFRESH)).not.toBeNull();

    const accessDirs = getCookieDirectives(res, COOKIE_ACCESS);
    expect(accessDirs['httponly']).toBe(true);
    expect(accessDirs['samesite']).toBe('lax');
  });

  it('does NOT set secure flag outside production', async () => {
    prismaMock.jwtToken.create.mockResolvedValueOnce({});
    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } });
    const res = await POST(req);

    const dirs = getCookieDirectives(res, COOKIE_ACCESS);
    expect(dirs['secure']).toBeUndefined();
  });

  it('stores a jwtToken record in the database', async () => {
    prismaMock.jwtToken.create.mockResolvedValueOnce({});
    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-superadmin-1' } });
    await POST(req);

    expect(prismaMock.jwtToken.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.jwtToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          access_jti: expect.any(String),
          refresh_jti: expect.any(String),
        }),
      }),
    );
  });

  it('reflects is_admin=true for admin tickets', async () => {
    prismaMock.jwtToken.create.mockResolvedValueOnce({});
    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-superadmin-1' } });
    const res = await POST(req);
    const { body } = await parseJson<any>(res);
    expect(body.isAdmin).toBe(true);
  });
});
