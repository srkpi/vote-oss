import * as allure from 'allure-js-commons';

import { rateLimitMock, resetRateLimitMock } from '@/__tests__/helpers/rate-limit-mock';
import { makeRequest, parseJson } from '@/__tests__/helpers/request';

jest.mock('@/lib/rate-limit', () => rateLimitMock);

const qrCodeMock = { toDataURL: jest.fn() };
jest.mock('qrcode', () => qrCodeMock);

const fetchMock = jest.fn();
global.fetch = fetchMock;

import { POST } from '@/app/api/auth/diia/init/route';

const MOCK_DEEP_LINK = 'https://example.com';
const MOCK_PAGE_LINK = 'https://example.com';
const MOCK_REQUEST_ID = 'req-uuid-001';
const MOCK_QR_DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

function makeLinkResponse(overrides: Record<string, unknown> = {}) {
  return {
    deepLink: MOCK_DEEP_LINK,
    pageLink: MOCK_PAGE_LINK,
    requestId: MOCK_REQUEST_ID,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function mockProviderOk(body = makeLinkResponse()) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }));
}

function mockProviderError(status = 500) {
  fetchMock.mockResolvedValueOnce(new Response('error', { status }));
}

function mockProviderNetworkFailure() {
  fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('POST /api/auth/diia/init', () => {
  beforeEach(() => {
    resetRateLimitMock();
    fetchMock.mockReset();
    qrCodeMock.toDataURL.mockReset().mockResolvedValue(MOCK_QR_DATA_URL);
    allure.feature('Auth');
    allure.story('Diia Init');
  });

  // ── Rate limiting ──────────────────────────────────────────────────────────

  it('returns 429 when rate limit is exceeded', async () => {
    rateLimitMock.rateLimitLogin.mockResolvedValueOnce({
      limited: true,
      remaining: 0,
      resetInMs: 60_000,
    });

    const req = makeRequest({ method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(429);
  });

  it('includes Retry-After header rounded up to seconds on 429', async () => {
    rateLimitMock.rateLimitLogin.mockResolvedValueOnce({
      limited: true,
      remaining: 0,
      resetInMs: 45_000,
    });

    const req = makeRequest({ method: 'POST' });
    const res = await POST(req);

    expect(res.headers.get('Retry-After')).toBe('45');
  });

  it('rounds Retry-After up when resetInMs is not a whole number of seconds', async () => {
    rateLimitMock.rateLimitLogin.mockResolvedValueOnce({
      limited: true,
      remaining: 0,
      resetInMs: 30_500,
    });

    const req = makeRequest({ method: 'POST' });
    const res = await POST(req);

    expect(res.headers.get('Retry-After')).toBe('31');
  });

  it('calls getClientIp to extract the caller IP for rate limiting', async () => {
    mockProviderOk();

    const req = makeRequest({ method: 'POST' });
    await POST(req);

    expect(rateLimitMock.getClientIp).toHaveBeenCalledTimes(1);
  });

  it('does not contact the provider when rate limit is exceeded', async () => {
    rateLimitMock.rateLimitLogin.mockResolvedValueOnce({
      limited: true,
      remaining: 0,
      resetInMs: 10_000,
    });

    const req = makeRequest({ method: 'POST' });
    await POST(req);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ── Provider failures ─────────────────────────────────────────────────────

  it('returns 500 when the KPI-ID provider returns a non-OK HTTP status', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockProviderError(503);

    const req = makeRequest({ method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });

  it('returns 500 when a 4xx error is returned by the provider', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockProviderError(404);

    const req = makeRequest({ method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });

  it('returns 500 when the fetch to the provider throws a network error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockProviderNetworkFailure();

    const req = makeRequest({ method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });

  it('returns 500 when provider responds with an empty deepLink', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockProviderOk(makeLinkResponse({ deepLink: '' }));

    const req = makeRequest({ method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });

  it('returns 500 when provider responds with an empty requestId', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockProviderOk(makeLinkResponse({ requestId: '' }));

    const req = makeRequest({ method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });

  it('returns 500 when provider response omits deepLink entirely', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockProviderOk(makeLinkResponse({ deepLink: undefined }));

    const req = makeRequest({ method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });

  it('returns 500 when provider response omits requestId entirely', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockProviderOk(makeLinkResponse({ requestId: undefined }));

    const req = makeRequest({ method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });

  // ── QR code failures ──────────────────────────────────────────────────────

  it('returns 500 when QRCode.toDataURL throws', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockProviderOk();
    qrCodeMock.toDataURL.mockRejectedValueOnce(new Error('canvas error'));

    const req = makeRequest({ method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns 200 on a successful request', async () => {
    mockProviderOk();

    const req = makeRequest({ method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  it('response body contains deepLink matching provider value', async () => {
    mockProviderOk();

    const req = makeRequest({ method: 'POST' });
    const { body } = await parseJson<any>(await POST(req));

    expect(body.deepLink).toBe(MOCK_DEEP_LINK);
  });

  it('response body contains requestId matching provider value', async () => {
    mockProviderOk();

    const req = makeRequest({ method: 'POST' });
    const { body } = await parseJson<any>(await POST(req));

    expect(body.requestId).toBe(MOCK_REQUEST_ID);
  });

  it('response body contains the QR code data-URL produced by QRCode.toDataURL', async () => {
    mockProviderOk();

    const req = makeRequest({ method: 'POST' });
    const { body } = await parseJson<any>(await POST(req));

    expect(body.qrCode).toBe(MOCK_QR_DATA_URL);
  });

  it('response body contains a valid ISO expiresAt timestamp', async () => {
    mockProviderOk();

    const req = makeRequest({ method: 'POST' });
    const { body } = await parseJson<any>(await POST(req));

    expect(body.expiresAt).toBeDefined();
    expect(isNaN(new Date(body.expiresAt).getTime())).toBe(false);
  });

  it('expiresAt is set in the future relative to the request time', async () => {
    mockProviderOk();

    const before = Date.now();
    const req = makeRequest({ method: 'POST' });
    const { body } = await parseJson<any>(await POST(req));

    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(before);
  });

  it('passes the provider deepLink to QRCode.toDataURL', async () => {
    mockProviderOk();

    const req = makeRequest({ method: 'POST' });
    await POST(req);

    expect(qrCodeMock.toDataURL).toHaveBeenCalledTimes(1);
    expect(qrCodeMock.toDataURL).toHaveBeenCalledWith(MOCK_DEEP_LINK, expect.any(Object));
  });

  it('hits the /api/diia/app-link endpoint on the KPI-ID provider', async () => {
    mockProviderOk();

    const req = makeRequest({ method: 'POST' });
    await POST(req);

    const calledUrl: string = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('/api/diia/app-link');
  });
});
