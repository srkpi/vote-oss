import * as allure from 'allure-js-commons';

import { MOCK_USER_INFO } from '@/__tests__/helpers/kpi-id-mock';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { getCookieDirectives, makeRequest, parseJson } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';
import { COOKIE_ACCESS, COOKIE_PENDING_BYPASS, COOKIE_RETURN_TO } from '@/lib/constants';
import { Errors } from '@/lib/errors';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/kpi-id', () => ({
  getCampusUserData: jest.fn(),
}));
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({ ok: false }),
}));
jest.mock('@/lib/bypass', () => ({
  applyBypassToken: jest.fn(),
  invalidateUserBypassCache: jest.fn().mockResolvedValue(undefined),
}));

import { POST } from '@/app/api/auth/diia/check/route';
import { requireAuth } from '@/lib/auth';
import { applyBypassToken } from '@/lib/bypass';
import { getCampusUserData } from '@/lib/kpi-id';

const fetchMock = jest.fn();
global.fetch = fetchMock;

const MOCK_REQUEST_ID = 'req-uuid-001';

function mockFullHappyPath() {
  fetchMock
    .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'Finished', sessionId: 'ses-1' })))
    .mockResolvedValueOnce(new Response('{}', { headers: { 'Set-Cookie': 'PHPSESSID=123;' } }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: { STUDENT_ID: 'user-001' } })))
    .mockResolvedValueOnce(new Response('OK')); // logout

  (getCampusUserData as jest.Mock).mockResolvedValue(MOCK_USER_INFO);
}

describe('POST /api/auth/diia/check', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    fetchMock.mockReset();
    (requireAuth as jest.Mock).mockResolvedValue({ ok: false });
    // Default: bypass succeeds (not called unless pending_bypass cookie present)
    (applyBypassToken as jest.Mock).mockReset().mockResolvedValue({
      type: 'GLOBAL',
      electionId: null,
    });
    allure.feature('Auth');
    allure.story('Diia Check');
  });

  // ── Polling states ────────────────────────────────────────────────────────

  it('returns 200 processing when provider returns processing', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'Processing' })));
    const res = await POST(makeRequest({ method: 'POST', body: { requestId: MOCK_REQUEST_ID } }));
    const { body } = await parseJson<any>(res);
    expect(body.status).toBe('processing');
  });

  it('returns 500 on internal auth failure', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'Finished', sessionId: '1' })))
      .mockResolvedValueOnce(new Response('Error', { status: 500 }));
    const res = await POST(makeRequest({ method: 'POST', body: { requestId: MOCK_REQUEST_ID } }));
    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });

  it('returns the exact error NextResponse from getCampusUserData (e.g., 403 Forbidden)', async () => {
    mockFullHappyPath();
    (getCampusUserData as jest.Mock).mockResolvedValueOnce(Errors.forbidden('Bypass failed'));

    const res = await POST(makeRequest({ method: 'POST', body: { requestId: MOCK_REQUEST_ID } }));
    expect(res.status).toBe(403);
  });

  it('revokes existing session if present', async () => {
    mockFullHappyPath();
    (requireAuth as jest.Mock).mockResolvedValueOnce({ ok: true, user: { jti: 'old', iat: 123 } });

    await POST(makeRequest({ method: 'POST', body: { requestId: MOCK_REQUEST_ID } }));
    expect(tokenStoreMock.revokeByAccessJti).toHaveBeenCalledWith('old', 123);
  });

  it('issues tokens and fires logout on success', async () => {
    mockFullHappyPath();
    const res = await POST(makeRequest({ method: 'POST', body: { requestId: MOCK_REQUEST_ID } }));

    expect(res.status).toBe(200);
    expect(tokenStoreMock.persistTokenPair).toHaveBeenCalled();
    expect(getCookieDirectives(res, COOKIE_ACCESS)['httponly']).toBe(true);

    const logoutCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/logout'));
    expect(logoutCall).toBeDefined();
  });

  // ── redirectTo ────────────────────────────────────────────────────────────

  it('returns status: success and redirectTo in response body on success', async () => {
    mockFullHappyPath();
    const { body } = await parseJson<{ status: string; redirectTo: string }>(
      await POST(makeRequest({ method: 'POST', body: { requestId: MOCK_REQUEST_ID } })),
    );
    expect(body.status).toBe('success');
    expect(body.redirectTo).toBe('/elections');
  });

  it('uses return_to cookie for redirectTo when no bypass was pre-applied', async () => {
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

  it('clears the return_to cookie in the response', async () => {
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

  // ── Pending bypass pre-application ────────────────────────────────────────

  it('does not call applyBypassToken when no pending_bypass cookie is present', async () => {
    mockFullHappyPath();
    await POST(makeRequest({ method: 'POST', body: { requestId: MOCK_REQUEST_ID } }));
    expect(applyBypassToken).not.toHaveBeenCalled();
  });

  it('calls applyBypassToken with the STUDENT_ID and token from the pending_bypass cookie', async () => {
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

  it('redirects to /elections when global bypass was pre-applied', async () => {
    mockFullHappyPath();
    (applyBypassToken as jest.Mock).mockResolvedValueOnce({ type: 'GLOBAL', electionId: null });
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

  it('redirects to the election page when an election bypass was pre-applied', async () => {
    mockFullHappyPath();
    (applyBypassToken as jest.Mock).mockResolvedValueOnce({
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

  it('ignores bypass failure and falls back to return_to when applyBypassToken throws', async () => {
    mockFullHappyPath();
    (applyBypassToken as jest.Mock).mockRejectedValueOnce(new Error('expired'));
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

  it('clears the pending_bypass cookie in the response', async () => {
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

  it('still completes auth when bypass application fails (getCampusUserData decides access)', async () => {
    mockFullHappyPath();
    (applyBypassToken as jest.Mock).mockRejectedValueOnce(new Error('Usage limit reached'));
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
