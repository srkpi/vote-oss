import * as allure from 'allure-js-commons';

import { kpiIdMock, resetKpiIdMock } from '@/__tests__/helpers/kpi-id-mock';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { rateLimitMock, resetRateLimitMock } from '@/__tests__/helpers/rate-limit-mock';
import { getCookieDirectives, makeRequest, parseJson } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';
import { COOKIE_ACCESS, COOKIE_PENDING_BYPASS, COOKIE_RETURN_TO } from '@/lib/constants';
import { Errors } from '@/lib/errors';

jest.mock('@/lib/kpi-id', () => kpiIdMock);
jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/rate-limit', () => rateLimitMock);
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({ ok: false }),
}));
jest.mock('@/lib/bypass', () => ({
  applyBypassToken: jest.fn(),
  invalidateUserBypassCache: jest.fn().mockResolvedValue(undefined),
}));

import { POST } from '@/app/api/auth/kpi-id/route';
import { requireAuth } from '@/lib/auth';
import { applyBypassToken } from '@/lib/bypass';

describe('POST /api/auth/kpi-id', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetRateLimitMock();
    resetKpiIdMock();
    (requireAuth as jest.Mock).mockResolvedValue({ ok: false });
    // Default: bypass succeeds (won't be called unless pending_bypass cookie present)
    (applyBypassToken as jest.Mock).mockReset().mockResolvedValue({
      type: 'GLOBAL',
      electionId: null,
    });
    allure.feature('Auth');
    allure.story('KPI ID Login');
  });

  // ── Rate limiting ──────────────────────────────────────────────────────────

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

  // ── Validation ────────────────────────────────────────────────────────────

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

  // ── Auth flow ─────────────────────────────────────────────────────────────

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

  // ── redirectTo ────────────────────────────────────────────────────────────

  it('returns redirectTo: /elections in response body when no return_to cookie', async () => {
    const { body } = await parseJson<{ redirectTo: string }>(
      await POST(makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } })),
    );
    expect(body.redirectTo).toBe('/elections');
  });

  it('uses return_to cookie value for redirectTo when no bypass was pre-applied', async () => {
    const { body } = await parseJson<{ redirectTo: string }>(
      await POST(
        makeRequest({
          method: 'POST',
          body: { ticketId: 'ticket-user-1' },
          cookies: { [COOKIE_RETURN_TO]: '/elections/some-id' },
        }),
      ),
    );
    expect(body.redirectTo).toBe('/elections/some-id');
  });

  it('ignores return_to cookie if it does not start with /', async () => {
    const { body } = await parseJson<{ redirectTo: string }>(
      await POST(
        makeRequest({
          method: 'POST',
          body: { ticketId: 'ticket-user-1' },
          cookies: { [COOKIE_RETURN_TO]: 'https://evil.com' },
        }),
      ),
    );
    expect(body.redirectTo).toBe('/elections');
  });

  it('clears the return_to cookie in the response', async () => {
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: { ticketId: 'ticket-user-1' },
        cookies: { [COOKIE_RETURN_TO]: '/some/path' },
      }),
    );
    const setCookies = res.headers.getSetCookie?.() ?? [];
    const clearEntry = setCookies.find((c) => c.startsWith(`${COOKIE_RETURN_TO}=`));
    expect(clearEntry).toMatch(/max-age=0/i);
  });

  // ── Pending bypass pre-application ────────────────────────────────────────

  it('does not call applyBypassToken when no pending_bypass cookie is present', async () => {
    await POST(makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } }));
    expect(applyBypassToken).not.toHaveBeenCalled();
  });

  it('calls applyBypassToken with correct userId and token when pending_bypass cookie is set', async () => {
    await POST(
      makeRequest({
        method: 'POST',
        body: { ticketId: 'ticket-user-1' },
        cookies: { [COOKIE_PENDING_BYPASS]: 'raw-bypass-token' },
      }),
    );
    // user-001 is the STUDENT_ID returned by the ticket-user-1 fixture
    expect(applyBypassToken).toHaveBeenCalledWith('user-001', 'raw-bypass-token');
  });

  it('redirects to /elections when global bypass was pre-applied', async () => {
    (applyBypassToken as jest.Mock).mockResolvedValueOnce({ type: 'GLOBAL', electionId: null });
    const { body } = await parseJson<{ redirectTo: string }>(
      await POST(
        makeRequest({
          method: 'POST',
          body: { ticketId: 'ticket-user-1' },
          cookies: { [COOKIE_PENDING_BYPASS]: 'global-token' },
        }),
      ),
    );
    expect(body.redirectTo).toBe('/elections');
  });

  it('redirects to the election page when an election bypass was pre-applied', async () => {
    (applyBypassToken as jest.Mock).mockResolvedValueOnce({
      type: 'ELECTION',
      electionId: 'abc-election-id',
    });
    const { body } = await parseJson<{ redirectTo: string }>(
      await POST(
        makeRequest({
          method: 'POST',
          body: { ticketId: 'ticket-user-1' },
          cookies: { [COOKIE_PENDING_BYPASS]: 'election-token' },
        }),
      ),
    );
    expect(body.redirectTo).toBe('/elections/abc-election-id');
  });

  it('ignores bypass failure and falls back to return_to when applyBypassToken throws', async () => {
    (applyBypassToken as jest.Mock).mockRejectedValueOnce(new Error('expired'));
    const { body } = await parseJson<{ redirectTo: string }>(
      await POST(
        makeRequest({
          method: 'POST',
          body: { ticketId: 'ticket-user-1' },
          cookies: {
            [COOKIE_PENDING_BYPASS]: 'bad-token',
            [COOKIE_RETURN_TO]: '/elections/fallback',
          },
        }),
      ),
    );
    // bypass failed → pendingBypassResult is null → use return_to
    expect(body.redirectTo).toBe('/elections/fallback');
  });

  it('clears the pending_bypass cookie in the response', async () => {
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: { ticketId: 'ticket-user-1' },
        cookies: { [COOKIE_PENDING_BYPASS]: 'some-token' },
      }),
    );
    const setCookies = res.headers.getSetCookie?.() ?? [];
    const clearEntry = setCookies.find((c) => c.startsWith(`${COOKIE_PENDING_BYPASS}=`));
    expect(clearEntry).toMatch(/max-age=0/i);
  });

  it('still succeeds even when bypass is invalid (getCampusUserData determines access)', async () => {
    (applyBypassToken as jest.Mock).mockRejectedValueOnce(new Error('Usage limit reached'));
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: { ticketId: 'ticket-user-1' },
        cookies: { [COOKIE_PENDING_BYPASS]: 'exhausted-token' },
      }),
    );
    // kpiIdMock.getCampusUserData returns MOCK_USER_INFO by default → 200
    expect(res.status).toBe(200);
  });
});
