import * as allure from 'allure-js-commons';

import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/jwt';

import { ADMIN_RECORD } from '../../helpers/fixtures';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { rateLimitMock, resetRateLimitMock } from '../../helpers/rate-limit-mock';
import {
  getCookieDirectives,
  getResponseCookie,
  makeRequest,
  parseJson,
} from '../../helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '../../helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/rate-limit', () => rateLimitMock);

import { POST } from '@/app/api/auth/kpi-id/route';

describe('POST /api/auth/kpi-id', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetRateLimitMock();
    allure.feature('Auth');
    allure.story('KPI ID Login');
  });

  it('returns 429 when rate limit is exceeded', async () => {
    rateLimitMock.rateLimitLogin.mockResolvedValueOnce({
      limited: true,
      remaining: 0,
      resetInMs: 50_000,
    });
    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it('includes Retry-After header on 429 response', async () => {
    rateLimitMock.rateLimitLogin.mockResolvedValueOnce({
      limited: true,
      remaining: 0,
      resetInMs: 30_000,
    });
    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } });
    const res = await POST(req);
    expect(res.headers.get('Retry-After')).toBe('30');
  });

  it('returns 400 when body is not valid JSON', async () => {
    const req = makeRequest({ method: 'POST' });
    req.json = jest.fn().mockRejectedValueOnce(new Error('bad json'));
    const res = await POST(req);
    const { status } = await parseJson(res);
    expect(status).toBe(400);
  });

  it('returns 400 when ticketId is missing', async () => {
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

  it('returns 200 with user info and isAdmin=false for a regular user ticket', async () => {
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } });
    const res = await POST(req);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body.userId).toBe('user-001');
    expect(body.fullName).toBe('Ivan Petrenko');
    expect(body.isAdmin).toBe(false);
    expect(body.faculty).toBe('FICE');
  });

  it('returns isAdmin=true when the user exists in the admins table', async () => {
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);

    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-superadmin-1' } });
    const res = await POST(req);
    const { body } = await parseJson<any>(res);
    expect(body.isAdmin).toBe(true);
  });

  it('returns isAdmin=false when admin record is absent even for an admin ticket', async () => {
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-superadmin-1' } });
    const res = await POST(req);
    const { body } = await parseJson<any>(res);
    expect(body.isAdmin).toBe(false);
  });

  it('sets HTTPOnly access_token and refresh_token cookies', async () => {
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } });
    const res = await POST(req);

    expect(getResponseCookie(res, COOKIE_ACCESS)).not.toBeNull();
    expect(getResponseCookie(res, COOKIE_REFRESH)).not.toBeNull();

    const accessDirs = getCookieDirectives(res, COOKIE_ACCESS);
    expect(accessDirs['httponly']).toBe(true);
    expect(accessDirs['samesite']).toBe('lax');
  });

  it('does NOT set the secure flag outside production', async () => {
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } });
    const res = await POST(req);

    const dirs = getCookieDirectives(res, COOKIE_ACCESS);
    expect(dirs['secure']).toBeUndefined();
  });

  it('calls persistTokenPair with the new access and refresh JTIs', async () => {
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } });
    await POST(req);

    expect(tokenStoreMock.persistTokenPair).toHaveBeenCalledTimes(1);
    expect(tokenStoreMock.persistTokenPair).toHaveBeenCalledWith(
      expect.any(String), // accessJti
      expect.any(String), // refreshJti
    );
  });

  it('queries the admins table with the resolved userId', async () => {
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } });
    await POST(req);

    expect(prismaMock.admin.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: 'user-001' } }),
    );
  });

  it('calls getClientIp to extract the client IP for rate limiting', async () => {
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } });
    await POST(req);

    expect(rateLimitMock.getClientIp).toHaveBeenCalledTimes(1);
  });
});
