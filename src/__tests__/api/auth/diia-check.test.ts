import * as allure from 'allure-js-commons';

import { MOCK_USER_INFO } from '@/__tests__/helpers/kpi-id-mock';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { getCookieDirectives, makeRequest, parseJson } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';
import { COOKIE_ACCESS } from '@/lib/constants';
import { Errors } from '@/lib/errors';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/kpi-id', () => ({
  getCampusUserData: jest.fn(),
}));
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({ ok: false }),
}));

import { POST } from '@/app/api/auth/diia/check/route';
import { requireAuth } from '@/lib/auth';
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
    allure.feature('Auth');
    allure.story('Diia Check');
  });

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
});
