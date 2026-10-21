import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { USER_PAYLOAD } from '@/__tests__/helpers/fixtures';
import { MOCK_USER_INFO } from '@/__tests__/helpers/kpi-id-mock';
import { resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { getCookieDirectives, makeRequest, parseJson } from '@/__tests__/helpers/request';
import { TEST_NOW } from '@/__tests__/helpers/time';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';
import { COOKIE_ACCESS, COOKIE_PENDING_BYPASS, COOKIE_RETURN_TO } from '@/lib/constants';
import { Errors } from '@/lib/errors';

vi.mock('@/lib/prisma', async () => {
  const { prismaMock } = await import('@/__tests__/helpers/prisma-mock');
  return { prisma: prismaMock };
});
vi.mock('@/lib/token-store', async () => {
  const { tokenStoreMock } = await import('@/__tests__/helpers/token-store-mock');
  return tokenStoreMock;
});
vi.mock('@/lib/kpi-id', () => ({
  getCampusUserData: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ ok: false }),
}));
vi.mock('@/lib/bypass', () => ({
  applyBypassToken: vi.fn(),
  invalidateUserBypassCache: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from '@/app/api/auth/diia/check/route';
import { requireAuth } from '@/lib/auth';
import { applyBypassToken } from '@/lib/bypass';
import { getCampusUserData } from '@/lib/kpi-id';

const fetchMock = vi.fn<typeof fetch>();

const MOCK_REQUEST_ID = 'req-uuid-001';

function mockFullHappyPath() {
  fetchMock
    .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'Finished', sessionId: 'ses-1' })))
    .mockResolvedValueOnce(new Response('{}', { headers: { 'Set-Cookie': 'PHPSESSID=123;' } }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: { STUDENT_ID: 'user-001' } })))
    .mockResolvedValueOnce(new Response('OK')); // logout

  vi.mocked(getCampusUserData).mockResolvedValue(MOCK_USER_INFO);
}

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetPrismaMock();
  resetTokenStoreMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Completing Diia sign-in (POST /api/auth/diia/check)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    vi.mocked(requireAuth).mockResolvedValue({
      ok: false,
      error: 'Missing access token',
      status: 401,
    });
    // Default: bypass succeeds (not called unless pending_bypass cookie present)
    vi.mocked(applyBypassToken).mockReset().mockResolvedValue({
      type: 'GLOBAL',
      electionId: null,
    });
    allure.feature('Auth');
    allure.story('Diia Check');
  });

  // ── Polling states ────────────────────────────────────────────────────────

  describe('when completing provider authentication', () => {
    it('should report sign-in as processing when the provider has not completed authentication', async () => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'Processing' })));
      const res = await POST(makeRequest({ method: 'POST', body: { requestId: MOCK_REQUEST_ID } }));
      const { body } = await parseJson<any>(res);
      expect(body.status).toBe('processing');
    });

    it('should report sign-in failure with 500 when provider session authentication fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      fetchMock
        .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'Finished', sessionId: '1' })))
        .mockResolvedValueOnce(new Response('Error', { status: 500 }));
      const res = await POST(makeRequest({ method: 'POST', body: { requestId: MOCK_REQUEST_ID } }));
      expect(res.status).toBe(500);
      consoleSpy.mockRestore();
    });

    it('should return the campus access denial when student eligibility checks fail', async () => {
      mockFullHappyPath();
      vi.mocked(getCampusUserData).mockResolvedValueOnce(Errors.forbidden('Bypass failed'));

      const res = await POST(makeRequest({ method: 'POST', body: { requestId: MOCK_REQUEST_ID } }));
      expect(res.status).toBe(403);
    });

    it('should revoke the previous session when an already signed-in user authenticates again', async () => {
      mockFullHappyPath();
      vi.mocked(requireAuth).mockResolvedValueOnce({
        ok: true,
        user: { ...USER_PAYLOAD, jti: 'old', iat: 123, tokenType: 'access' },
      });

      await POST(makeRequest({ method: 'POST', body: { requestId: MOCK_REQUEST_ID } }));
      expect(tokenStoreMock.revokeByAccessJti).toHaveBeenCalledWith('old', 123);
    });

    it('should issue session tokens and end the provider session after successful sign-in', async () => {
      mockFullHappyPath();
      const res = await POST(makeRequest({ method: 'POST', body: { requestId: MOCK_REQUEST_ID } }));

      expect(res.status).toBe(200);
      expect(tokenStoreMock.persistTokenPair).toHaveBeenCalled();
      expect(getCookieDirectives(res, COOKIE_ACCESS)['httponly']).toBe(true);

      const logoutCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/logout'));
      expect(logoutCall).toBeDefined();
    });
  });

  // ── redirectTo ────────────────────────────────────────────────────────────

  describe('when choosing the destination after sign-in', () => {
    it('should return status: success and redirectTo in response body when the request succeeds', async () => {
      mockFullHappyPath();
      const { body } = await parseJson<{ status: string; redirectTo: string }>(
        await POST(makeRequest({ method: 'POST', body: { requestId: MOCK_REQUEST_ID } })),
      );
      expect(body.status).toBe('success');
      expect(body.redirectTo).toBe('/elections');
    });

    it('should use return_to cookie for redirectTo when no bypass was pre-applied', async () => {
      mockFullHappyPath();
      const { body } = await parseJson<{ redirectTo: string }>(
        await POST(
          makeRequest({
            method: 'POST',
            body: { requestId: MOCK_REQUEST_ID },
            cookies: { [COOKIE_RETURN_TO]: '/elections/some-id' },
          }),
        ),
      );
      expect(body.redirectTo).toBe('/elections/some-id');
    });

    it('should clear the saved return destination after sign-in completes', async () => {
      mockFullHappyPath();
      const res = await POST(
        makeRequest({
          method: 'POST',
          body: { requestId: MOCK_REQUEST_ID },
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
      mockFullHappyPath();
      await POST(makeRequest({ method: 'POST', body: { requestId: MOCK_REQUEST_ID } }));
      expect(applyBypassToken).not.toHaveBeenCalled();
    });

    it('should activate the pending bypass for the student after successful provider authentication', async () => {
      mockFullHappyPath();
      await POST(
        makeRequest({
          method: 'POST',
          body: { requestId: MOCK_REQUEST_ID },
          cookies: { [COOKIE_PENDING_BYPASS]: 'raw-bypass-token' },
        }),
      );
      // STUDENT_ID comes from the mocked /api/user response: { data: { STUDENT_ID: 'user-001' } }
      expect(applyBypassToken).toHaveBeenCalledWith('user-001', 'raw-bypass-token');
    });

    it('should redirect to /elections when global bypass was pre-applied', async () => {
      mockFullHappyPath();
      vi.mocked(applyBypassToken).mockResolvedValueOnce({ type: 'GLOBAL', electionId: null });
      const { body } = await parseJson<{ redirectTo: string }>(
        await POST(
          makeRequest({
            method: 'POST',
            body: { requestId: MOCK_REQUEST_ID },
            cookies: { [COOKIE_PENDING_BYPASS]: 'global-token' },
          }),
        ),
      );
      expect(body.redirectTo).toBe('/elections');
    });

    it('should redirect to the election page when an election bypass was pre-applied', async () => {
      mockFullHappyPath();
      vi.mocked(applyBypassToken).mockResolvedValueOnce({
        type: 'ELECTION',
        electionId: 'abc-election-id',
      });
      const { body } = await parseJson<{ redirectTo: string }>(
        await POST(
          makeRequest({
            method: 'POST',
            body: { requestId: MOCK_REQUEST_ID },
            cookies: { [COOKIE_PENDING_BYPASS]: 'election-token' },
          }),
        ),
      );
      expect(body.redirectTo).toBe('/elections/abc-election-id');
    });

    it('should use the saved return destination when pending bypass activation fails', async () => {
      mockFullHappyPath();
      vi.mocked(applyBypassToken).mockRejectedValueOnce(new Error('expired'));
      const { body } = await parseJson<{ redirectTo: string }>(
        await POST(
          makeRequest({
            method: 'POST',
            body: { requestId: MOCK_REQUEST_ID },
            cookies: {
              [COOKIE_PENDING_BYPASS]: 'bad-token',
              [COOKIE_RETURN_TO]: '/elections/fallback',
            },
          }),
        ),
      );
      expect(body.redirectTo).toBe('/elections/fallback');
    });

    it('should clear the pending bypass cookie after sign-in completes', async () => {
      mockFullHappyPath();
      const res = await POST(
        makeRequest({
          method: 'POST',
          body: { requestId: MOCK_REQUEST_ID },
          cookies: { [COOKIE_PENDING_BYPASS]: 'some-token' },
        }),
      );
      const setCookies = res.headers.getSetCookie?.() ?? [];
      const clearEntry = setCookies.find((c) => c.startsWith(`${COOKIE_PENDING_BYPASS}=`));
      expect(clearEntry).toMatch(/max-age=0/i);
    });

    it('should complete sign-in when bypass activation fails but the student remains eligible', async () => {
      mockFullHappyPath();
      vi.mocked(applyBypassToken).mockRejectedValueOnce(new Error('Usage limit reached'));
      const res = await POST(
        makeRequest({
          method: 'POST',
          body: { requestId: MOCK_REQUEST_ID },
          cookies: { [COOKIE_PENDING_BYPASS]: 'exhausted-token' },
        }),
      );
      // getCampusUserData mock returns MOCK_USER_INFO → auth succeeds
      expect(res.status).toBe(200);
    });
  });
});
