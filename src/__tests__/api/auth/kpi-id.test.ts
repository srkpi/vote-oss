import * as allure from 'allure-js-commons';

import { kpiIdMock, resetKpiIdMock } from '@/__tests__/helpers/kpi-id-mock';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { rateLimitMock, resetRateLimitMock } from '@/__tests__/helpers/rate-limit-mock';
import {
  getCookieDirectives,
  getResponseCookie,
  makeRequest,
  parseJson,
} from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';
import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/constants';

jest.mock('@/lib/kpi-id', () => kpiIdMock);
jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/rate-limit', () => rateLimitMock);

import { POST } from '@/app/api/auth/kpi-id/route';

describe('POST /api/auth/kpi-id', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetRateLimitMock();
    resetKpiIdMock();
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

  it('returns 200 for a regular user ticket', async () => {
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } });
    const res = await POST(req);
    expect(res.status).toBe(200);
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
      expect.any(String),
      expect.any(String),
    );
  });

  it('queries the admins table with the resolved userId', async () => {
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } });
    await POST(req);

    expect(prismaMock.admin.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: 'user-001', deleted_at: null } }),
    );
  });

  it('calls getClientIp to extract the client IP for rate limiting', async () => {
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } });
    await POST(req);

    expect(rateLimitMock.getClientIp).toHaveBeenCalledTimes(1);
  });

  it('returns 403 when resolveTicket throws GraduateUserError', async () => {
    kpiIdMock.resolveTicket.mockRejectedValueOnce(
      new kpiIdMock.GraduateUserError('Platform is not available for graduate students'),
    );

    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-grad-1' } });
    const res = await POST(req);

    expect(res.status).toBe(403);
  });

  it('includes the graduate error message in the 403 response', async () => {
    const errorMessage = 'Platform is not available for graduate students';
    kpiIdMock.resolveTicket.mockRejectedValueOnce(new kpiIdMock.GraduateUserError(errorMessage));

    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-grad-1' } });
    const { body } = await parseJson<any>(await POST(req));

    expect(body.message).toBe(errorMessage);
  });

  it('does not set auth cookies when a graduate user is rejected', async () => {
    kpiIdMock.resolveTicket.mockRejectedValueOnce(new kpiIdMock.GraduateUserError());

    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-grad-1' } });
    const res = await POST(req);

    expect(getResponseCookie(res, COOKIE_ACCESS)).toBeNull();
    expect(getResponseCookie(res, COOKIE_REFRESH)).toBeNull();
  });

  it('does not call persistTokenPair when a graduate user is rejected', async () => {
    kpiIdMock.resolveTicket.mockRejectedValueOnce(new kpiIdMock.GraduateUserError());

    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-grad-1' } });
    await POST(req);

    expect(tokenStoreMock.persistTokenPair).not.toHaveBeenCalled();
  });
});
