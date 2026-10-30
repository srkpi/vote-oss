import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { USER_PAYLOAD } from '@/__tests__/helpers/fixtures';
import { kpiIdMock, resetKpiIdMock } from '@/__tests__/helpers/kpi-id-mock';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { rateLimitMock, resetRateLimitMock } from '@/__tests__/helpers/rate-limit-mock';
import { getCookieDirectives, makeRequest, parseJson } from '@/__tests__/helpers/request';
import { TEST_NOW } from '@/__tests__/helpers/time';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';
import { COOKIE_ACCESS, COOKIE_PENDING_BYPASS, COOKIE_RETURN_TO } from '@/lib/constants';
import { Errors } from '@/lib/errors';

vi.mock('@/lib/kpi-id', async () => {
  const { kpiIdMock } = await import('@/__tests__/helpers/kpi-id-mock');
  return kpiIdMock;
});
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
vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ ok: false }),
}));
vi.mock('@/lib/bypass', () => ({
  applyBypassToken: vi.fn(),
  invalidateUserBypassCache: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from '@/app/api/auth/kpi-id/route';
import { requireAuth } from '@/lib/auth';
import { applyBypassToken } from '@/lib/bypass';
import { completeLogin } from '@/lib/login-session';

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetPrismaMock();
  resetTokenStoreMock();
  resetRateLimitMock();
  resetKpiIdMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Signing in through KPI-ID (POST /api/auth/kpi-id)', () => {
  beforeEach(() => {
    vi.mocked(requireAuth).mockResolvedValue({
      ok: false,
      error: 'Missing access token',
      status: 401,
    });
    // Default: bypass succeeds (won't be called unless pending_bypass cookie present)
    vi.mocked(applyBypassToken).mockReset().mockResolvedValue({
      type: 'GLOBAL',
      electionId: null,
    });
    allure.feature('Auth');
    allure.story('KPI ID Login');
  });

  // ── Rate limiting ──────────────────────────────────────────────────────────

  it('should return 429 when rate limit is exceeded', async () => {
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

  describe('when validating the sign-in ticket', () => {
    it('should reject sign-in with 400 when the ticket ID is missing', async () => {
      const res1 = await POST(makeRequest({ method: 'POST', body: {} }));
      expect(res1.status).toBe(400);
    });

    it('should return 401 when resolveTicket throws InvalidTicketError', async () => {
      kpiIdMock.resolveTicket.mockRejectedValueOnce(new kpiIdMock.InvalidTicketError());
      const res = await POST(makeRequest({ method: 'POST', body: { ticketId: 'bad' } }));
      expect(res.status).toBe(401);
    });

    it('should return the campus access denial when student eligibility checks fail', async () => {
      kpiIdMock.getCampusUserData.mockResolvedValueOnce(Errors.forbidden('Not a student'));
      const res = await POST(makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } }));
      expect(res.status).toBe(403);
    });
  });

  // ── Auth flow ─────────────────────────────────────────────────────────────

  describe('when establishing the signed-in session', () => {
    it('should revoke the previous session when an already signed-in user authenticates again', async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce({
        ok: true,
        user: { ...USER_PAYLOAD, jti: 'old', iat: 123, tokenType: 'access' },
      });
      await POST(makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } }));
      expect(tokenStoreMock.revokeByAccessJti).toHaveBeenCalledWith('old', 123);
    });

    it('should issue session tokens and set session cookies after successful sign-in', async () => {
      const res = await POST(makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } }));

      expect(res.status).toBe(200);
      expect(tokenStoreMock.persistTokenPair).toHaveBeenCalled();

      const accessDirs = getCookieDirectives(res, COOKIE_ACCESS);
      expect(accessDirs['httponly']).toBe(true);
      expect(accessDirs['samesite']).toBe('lax');
    });

    it('should include admin permissions when the signed-in user is an active admin', async () => {
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

  // ── redirectTo ────────────────────────────────────────────────────────────

  describe('when choosing the destination after sign-in', () => {
    it('should return redirectTo: /elections in response body when no return_to cookie', async () => {
      const { body } = await parseJson<{ redirectTo: string }>(
        await POST(makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } })),
      );
      expect(body.redirectTo).toBe('/elections');
    });

    it('should use return_to cookie value for redirectTo when no bypass was pre-applied', async () => {
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

    it('should ignore return_to cookie when it does not start with /', async () => {
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

    it('should clear the saved return destination after sign-in completes', async () => {
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
  });

  // ── Pending bypass pre-application ────────────────────────────────────────

  describe('when resolving a pending bypass during sign-in', () => {
    it('should skip bypass activation when no pending bypass cookie is present', async () => {
      await POST(makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } }));
      expect(applyBypassToken).not.toHaveBeenCalled();
    });

    it('should activate the pending bypass for the student when its cookie is present', async () => {
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

    it('should redirect to /elections when global bypass was pre-applied', async () => {
      vi.mocked(applyBypassToken).mockResolvedValueOnce({ type: 'GLOBAL', electionId: null });
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

    it('should redirect to the election page when an election bypass was pre-applied', async () => {
      vi.mocked(applyBypassToken).mockResolvedValueOnce({
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

    it('should use the saved return destination when pending bypass activation fails', async () => {
      vi.mocked(applyBypassToken).mockRejectedValueOnce(new Error('expired'));
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

    it('should clear the pending bypass cookie after sign-in completes', async () => {
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

    it('should complete sign-in when an invalid bypass does not prevent student eligibility', async () => {
      vi.mocked(applyBypassToken).mockRejectedValueOnce(new Error('Usage limit reached'));
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
  it.each(['//evil.test', '/\\evil.test'])(
    'rejects an external return_to (%s)',
    async (returnTo) => {
      const response = await POST(
        makeRequest({
          method: 'POST',
          body: { ticketId: 'ticket-user-1' },
          cookies: { [COOKIE_RETURN_TO]: returnTo },
        }),
      );
      expect((await response.json()).redirectTo).toBe('/elections');
    },
  );
  it('can issue session cookies directly on the OIDC redirect response', async () => {
    const student = await kpiIdMock.resolveTicket('ticket-user-1');
    const request = makeRequest({ cookies: { [COOKIE_RETURN_TO]: '/elections/fallback' } });
    const response = await completeLogin(request, student, {
      userId: 'stable-user-id',
      redirect: true,
    });
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/elections/fallback');
    expect(response.cookies.get(COOKIE_ACCESS)?.value).toBeTruthy();
    expect(response.cookies.get(COOKIE_RETURN_TO)?.maxAge).toBe(0);
    expect(kpiIdMock.getCampusUserData).toHaveBeenCalledWith(student, 'stable-user-id');
  });
});
