import * as allure from 'allure-js-commons';

import { makeTokenPair, USER_PAYLOAD } from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';
import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/constants';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/kpi-id', () => ({
  ...jest.requireActual('@/lib/kpi-id'),
  resolveUserData: jest.fn(),
}));

import { GraduateUserError, resolveUserData } from '@/lib/kpi-id';

const fetchMock = jest.fn();
global.fetch = fetchMock;

import { POST } from '@/app/api/auth/diia/check/route';

const MOCK_REQUEST_ID = 'req-uuid-001';
const MOCK_SESSION_ID = 'session-uuid-001';
const MOCK_STUDENT_ID = 'user-001';
const MOCK_FULL_NAME = 'Ivan Petrenko';

const KPI_SESSION_COOKIE = 'PHPSESSID=abc123; Path=/; HttpOnly';

const MOCK_USER_INFO = {
  userId: MOCK_STUDENT_ID,
  fullName: MOCK_FULL_NAME,
  faculty: 'TEST',
  group: 'IP-24',
  speciality: '121',
  studyYear: 1,
  studyForm: 'Денна',
};

function makeCheckProcessing() {
  return new Response(JSON.stringify({ status: 'Processing', sessionId: null }), { status: 200 });
}

function makeCheckFinished(sessionId = MOCK_SESSION_ID) {
  return new Response(JSON.stringify({ status: 'Finished', sessionId }), { status: 200 });
}

function makeInternalAuthOk() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Set-Cookie': KPI_SESSION_COOKIE },
  });
}

function makeInternalAuthError(status = 401) {
  return new Response('Unauthorized', { status });
}

function makeUserDataOk(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      fullName: MOCK_FULL_NAME,
      data: {
        STUDENT_ID: MOCK_STUDENT_ID,
        NAME: MOCK_FULL_NAME,
        AUTH_METHOD: 'DIIA',
        ...overrides,
      },
    }),
    { status: 200 },
  );
}

/**
 * Mocks the three external fetch calls made by the route handler itself:
 *   1. check-request  → Finished
 *   2. internal-auth  → OK + Set-Cookie
 *   3. /api/user      → KPI ID user data
 *
 * resolveUserData is mocked at the module level so no further fetch calls
 * (voteoss, fetchFacultyGroups) are needed here.
 */
function mockFullHappyPath(userDataOverrides: Record<string, unknown> = {}) {
  fetchMock
    .mockResolvedValueOnce(makeCheckFinished())
    .mockResolvedValueOnce(makeInternalAuthOk())
    .mockResolvedValueOnce(makeUserDataOk(userDataOverrides));
}

function makeCheckRequest(requestId = MOCK_REQUEST_ID) {
  return makeRequest({
    method: 'POST',
    url: 'http://localhost/api/auth/diia/check',
    body: { requestId },
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('GET /api/auth/diia/check', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    fetchMock.mockReset().mockResolvedValue(new Response('OK', { status: 200 }));
    // Default: resolveUserData succeeds with a valid student
    (resolveUserData as jest.Mock).mockResolvedValue(MOCK_USER_INFO);
    allure.feature('Auth');
    allure.story('Diia Check');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ── Missing requestId ──────────────────────────────────────────────────────

  it('returns 400 when requestId query param is absent', async () => {
    const req = makeRequest({ method: 'GET', url: 'http://localhost/api/auth/diia/check' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // ── Still processing ──────────────────────────────────────────────────────

  it('returns 200 with status=processing when check-request returns Processing', async () => {
    fetchMock.mockResolvedValueOnce(makeCheckProcessing());

    const req = makeCheckRequest();
    const { status, body } = await parseJson<any>(await POST(req));

    expect(status).toBe(200);
    expect(body.status).toBe('processing');
  });

  it('returns status=processing when check-request endpoint returns non-OK HTTP', async () => {
    fetchMock.mockResolvedValueOnce(new Response('gone', { status: 410 }));

    const req = makeCheckRequest();
    const { body } = await parseJson<any>(await POST(req));

    expect(body.status).toBe('processing');
  });

  it('returns status=processing when the fetch to check-request throws a network error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const req = makeCheckRequest();
    const { body } = await parseJson<any>(await POST(req));

    expect(body.status).toBe('processing');
    consoleSpy.mockRestore();
  });

  // ── Internal auth failures (after Finished) ───────────────────────────────

  it('returns 500 when internal-auth endpoint returns a non-OK status', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(makeCheckFinished())
      .mockResolvedValueOnce(makeInternalAuthError(401));

    const req = makeCheckRequest();
    const res = await POST(req);

    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });

  it('returns 500 when the internal-auth fetch throws a network error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(makeCheckFinished())
      .mockRejectedValueOnce(new Error('socket hang up'));

    const req = makeCheckRequest();
    const res = await POST(req);

    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });

  it('returns 500 when internal-auth succeeds but returns no Set-Cookie header', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(makeCheckFinished())
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const req = makeCheckRequest();
    const res = await POST(req);

    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });

  // ── User data failures ────────────────────────────────────────────────────

  it('returns 500 when /api/user fetch returns non-OK', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(makeCheckFinished())
      .mockResolvedValueOnce(makeInternalAuthOk())
      .mockResolvedValueOnce(new Response('Server Error', { status: 500 }));

    const req = makeCheckRequest();
    const res = await POST(req);

    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });

  it('returns 500 when /api/user fetch throws a network error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(makeCheckFinished())
      .mockResolvedValueOnce(makeInternalAuthOk())
      .mockRejectedValueOnce(new Error('timeout'));

    const req = makeCheckRequest();
    const res = await POST(req);

    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });

  it('returns 500 when user data has no `data` field', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(makeCheckFinished())
      .mockResolvedValueOnce(makeInternalAuthOk())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ fullName: MOCK_FULL_NAME }), { status: 200 }),
      );

    const req = makeCheckRequest();
    const res = await POST(req);

    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });

  // ── Graduate student restriction ──────────────────────────────────────────

  it('returns 403 when the Diia user belongs to a graduate group', async () => {
    mockFullHappyPath({ GROUP: 'FT-51ф' });
    (resolveUserData as jest.Mock).mockRejectedValueOnce(new GraduateUserError());

    const req = makeCheckRequest();
    const res = await POST(req);

    expect(res.status).toBe(403);
  });

  it('includes a descriptive message in the 403 for graduate users', async () => {
    mockFullHappyPath({ GROUP: 'KV-11ф' });
    (resolveUserData as jest.Mock).mockRejectedValueOnce(new GraduateUserError());

    const req = makeCheckRequest();
    const { body } = await parseJson<any>(await POST(req));

    expect(body.message).toMatch(/graduate/i);
  });

  it('does not set auth cookies when a graduate Diia user is rejected', async () => {
    mockFullHappyPath({ GROUP: 'FT-51ф' });
    (resolveUserData as jest.Mock).mockRejectedValueOnce(new GraduateUserError());

    const req = makeCheckRequest();
    const res = await POST(req);

    const setCookies = res.headers.getSetCookie?.() ?? [];
    expect(setCookies.some((c) => c.startsWith(`${COOKIE_ACCESS}=`))).toBe(false);
    expect(setCookies.some((c) => c.startsWith(`${COOKIE_REFRESH}=`))).toBe(false);
  });

  it('still issues a fire-and-forget logout before the graduate check returns 403', async () => {
    mockFullHappyPath({ GROUP: 'FT-51ф' });
    (resolveUserData as jest.Mock).mockRejectedValueOnce(new GraduateUserError());

    const req = makeCheckRequest();
    await POST(req);

    const logoutCall = fetchMock.mock.calls.find(([url]: [string]) =>
      String(url).includes('/api/auth/logout'),
    );
    expect(logoutCall).toBeDefined();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns 200 with status=success for a valid student', async () => {
    mockFullHappyPath();
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeCheckRequest();
    const { status, body } = await parseJson<any>(await POST(req));

    expect(status).toBe(200);
    expect(body.status).toBe('success');
  });

  it('queries the admins table with the resolved studentId', async () => {
    mockFullHappyPath();
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeCheckRequest();
    await POST(req);

    expect(prismaMock.admin.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: MOCK_STUDENT_ID, deleted_at: null } }),
    );
  });

  // ── Cookie assertions ─────────────────────────────────────────────────────

  it('sets an access_token cookie on success', async () => {
    mockFullHappyPath();
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeCheckRequest();
    const res = await POST(req);

    const setCookies = res.headers.getSetCookie?.() ?? [];
    expect(setCookies.some((c) => c.startsWith(`${COOKIE_ACCESS}=`))).toBe(true);
  });

  it('sets a refresh_token cookie on success', async () => {
    mockFullHappyPath();
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeCheckRequest();
    const res = await POST(req);

    const setCookies = res.headers.getSetCookie?.() ?? [];
    expect(setCookies.some((c) => c.startsWith(`${COOKIE_REFRESH}=`))).toBe(true);
  });

  it('access_token cookie is HttpOnly', async () => {
    mockFullHappyPath();
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeCheckRequest();
    const res = await POST(req);

    const setCookies = res.headers.getSetCookie?.() ?? [];
    const accessCookie = setCookies.find((c) => c.startsWith(`${COOKIE_ACCESS}=`));
    expect(accessCookie?.toLowerCase()).toContain('httponly');
  });

  // ── Token store ───────────────────────────────────────────────────────────

  it('calls persistTokenPair with the new access and refresh JTIs', async () => {
    mockFullHappyPath();
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeCheckRequest();
    await POST(req);

    expect(tokenStoreMock.persistTokenPair).toHaveBeenCalledTimes(1);
    expect(tokenStoreMock.persistTokenPair).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(Date),
    );
  });

  // ── Existing session revocation ───────────────────────────────────────────

  it('revokes an existing valid session when an access token cookie is present', async () => {
    mockFullHappyPath();
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);
    tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);

    const { access } = await makeTokenPair(USER_PAYLOAD);
    const req = makeAuthRequest(access.token, {
      method: 'POST',
      url: 'http://localhost/api/auth/diia/check',
      body: { requestId: MOCK_REQUEST_ID },
    });
    await POST(req);

    expect(tokenStoreMock.revokeByAccessJti).toHaveBeenCalledWith(access.jti, expect.any(Number));
  });

  it('does not revoke when no access token cookie is present', async () => {
    mockFullHappyPath();
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeCheckRequest();
    await POST(req);

    expect(tokenStoreMock.revokeByAccessJti).not.toHaveBeenCalled();
  });

  it('does not revoke when the existing access token is invalid/revoked', async () => {
    mockFullHappyPath();
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);
    tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(false);

    const { access } = await makeTokenPair(USER_PAYLOAD);
    const req = makeAuthRequest(access.token, {
      method: 'POST',
      url: 'http://localhost/api/auth/diia/check',
      body: { requestId: MOCK_REQUEST_ID },
    });
    await POST(req);

    expect(tokenStoreMock.revokeByAccessJti).not.toHaveBeenCalled();
  });

  // ── KPI-ID logout (fire-and-forget) ──────────────────────────────────────

  it('issues a fire-and-forget logout call to KPI-ID after fetching user data', async () => {
    mockFullHappyPath();
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeCheckRequest();
    await POST(req);

    const logoutCall = fetchMock.mock.calls.find(([url]: [string]) =>
      String(url).includes('/api/auth/logout'),
    );
    expect(logoutCall).toBeDefined();
  });

  // ── check-request URL construction ───────────────────────────────────────

  it('includes the requestId in the check-request URL', async () => {
    mockFullHappyPath();
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);

    const req = makeCheckRequest('my-specific-request-id');
    await POST(req);

    const firstCallUrl: string = fetchMock.mock.calls[0][0];
    expect(firstCallUrl).toContain('requestId=my-specific-request-id');
  });
});
