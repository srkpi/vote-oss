import * as allure from 'allure-js-commons';

import { kpiIdMock, resetKpiIdMock } from '@/__tests__/helpers/kpi-id-mock';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { rateLimitMock, resetRateLimitMock } from '@/__tests__/helpers/rate-limit-mock';
import { getCookieDirectives, makeRequest } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';
import { COOKIE_ACCESS } from '@/lib/constants';
import { Errors } from '@/lib/errors';

jest.mock('@/lib/kpi-id', () => kpiIdMock);
jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/rate-limit', () => rateLimitMock);
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({ ok: false }),
}));

import { POST } from '@/app/api/auth/kpi-id/route';
import { requireAuth } from '@/lib/auth';

describe('POST /api/auth/kpi-id', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetRateLimitMock();
    resetKpiIdMock();
    (requireAuth as jest.Mock).mockResolvedValue({ ok: false });
    allure.feature('Auth');
    allure.story('KPI ID Login');
  });

  it('returns 429 when rate limit is exceeded', async () => {
    rateLimitMock.rateLimitLogin.mockResolvedValueOnce({
      limited: true,
      remaining: 0,
      resetInMs: 30_000,
    });
    const res = await POST(makeRequest({ method: 'POST', body: { ticketId: 'ticket-1' } }));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');
  });

  it('returns 400 when ticketId is missing or invalid JSON', async () => {
    const res1 = await POST(makeRequest({ method: 'POST', body: {} }));
    expect(res1.status).toBe(400);
  });

  it('returns 401 when resolveTicket throws InvalidTicketError', async () => {
    kpiIdMock.resolveTicket.mockRejectedValueOnce(new kpiIdMock.InvalidTicketError());
    const res = await POST(makeRequest({ method: 'POST', body: { ticketId: 'bad' } }));
    expect(res.status).toBe(401);
  });

  it('returns exactly what getCampusUserData returns if it is an error (e.g., 403)', async () => {
    kpiIdMock.getCampusUserData.mockResolvedValueOnce(Errors.forbidden('Not a student'));
    const res = await POST(makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } }));
    expect(res.status).toBe(403);
  });

  it('revokes previous token if already authenticated', async () => {
    (requireAuth as jest.Mock).mockResolvedValueOnce({ ok: true, user: { jti: 'old', iat: 123 } });
    await POST(makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } }));
    expect(tokenStoreMock.revokeByAccessJti).toHaveBeenCalledWith('old', 123);
  });

  it('generates tokens and sets cookies on success', async () => {
    const res = await POST(makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } }));

    expect(res.status).toBe(200);
    expect(tokenStoreMock.persistTokenPair).toHaveBeenCalled();

    const accessDirs = getCookieDirectives(res, COOKIE_ACCESS);
    expect(accessDirs['httponly']).toBe(true);
    expect(accessDirs['samesite']).toBe('lax');
  });

  it('appends admin claims if user is in admin table', async () => {
    prismaMock.admin.findUnique.mockResolvedValueOnce({
      user_id: 'user-001',
      manage_admins: true,
      restricted_to_faculty: 'FICE',
      deleted_at: null,
    } as any);

    await POST(makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } }));
    expect(prismaMock.admin.findUnique).toHaveBeenCalled();
  });
});
