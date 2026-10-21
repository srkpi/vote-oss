import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { qrCodeMock } from '@/__tests__/helpers/qrcode-mock';
import { rateLimitMock, resetRateLimitMock } from '@/__tests__/helpers/rate-limit-mock';
import { makeRequest, parseJson } from '@/__tests__/helpers/request';
import { TEST_NOW } from '@/__tests__/helpers/time';
import { DIIA_LINK_TTL_MS } from '@/lib/constants';

vi.mock('@/lib/rate-limit', async () => {
  const { rateLimitMock } = await import('@/__tests__/helpers/rate-limit-mock');
  return rateLimitMock;
});
vi.mock('qrcode', async () => {
  const { qrCodeMock } = await import('@/__tests__/helpers/qrcode-mock');
  return { default: qrCodeMock };
});

const fetchMock = vi.fn<typeof fetch>();

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

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetRateLimitMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Initializing Diia sign-in (POST /api/auth/diia/init)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    qrCodeMock.toDataURL.mockReset().mockResolvedValue(MOCK_QR_DATA_URL);
    allure.feature('Auth');
    allure.story('Diia Init');
  });

  // ── Rate limiting ──────────────────────────────────────────────────────────

  describe('when enforcing sign-in request limits', () => {
    it('should return 429 when rate limit is exceeded', async () => {
      rateLimitMock.rateLimitLogin.mockResolvedValueOnce({
        limited: true,
        remaining: 0,
        resetInMs: 60_000,
      });

      const req = makeRequest({ method: 'POST' });
      const res = await POST(req);

      expect(res.status).toBe(429);
    });

    it('should tell the caller how many seconds to wait when sign-in is rate-limited', async () => {
      rateLimitMock.rateLimitLogin.mockResolvedValueOnce({
        limited: true,
        remaining: 0,
        resetInMs: 45_000,
      });

      const req = makeRequest({ method: 'POST' });
      const res = await POST(req);

      expect(res.headers.get('Retry-After')).toBe('45');
    });

    it('should round Retry-After up when resetInMs is not a whole number of seconds', async () => {
      rateLimitMock.rateLimitLogin.mockResolvedValueOnce({
        limited: true,
        remaining: 0,
        resetInMs: 30_500,
      });

      const req = makeRequest({ method: 'POST' });
      const res = await POST(req);

      expect(res.headers.get('Retry-After')).toBe('31');
    });

    it('should identify the caller IP when enforcing the sign-in request limit', async () => {
      mockProviderOk();

      const req = makeRequest({ method: 'POST' });
      await POST(req);

      expect(rateLimitMock.getClientIp).toHaveBeenCalledTimes(1);
    });

    it('should not contact the provider when rate limit is exceeded', async () => {
      rateLimitMock.rateLimitLogin.mockResolvedValueOnce({
        limited: true,
        remaining: 0,
        resetInMs: 10_000,
      });

      const req = makeRequest({ method: 'POST' });
      await POST(req);

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // ── Provider failures ─────────────────────────────────────────────────────

  describe('when the sign-in provider fails or returns incomplete data', () => {
    it('should return 500 when the KPI-ID provider returns a non-OK HTTP status', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockProviderError(503);

      const req = makeRequest({ method: 'POST' });
      const res = await POST(req);

      expect(res.status).toBe(500);
      consoleSpy.mockRestore();
    });

    it('should return 500 when a 4xx error is returned by the provider', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockProviderError(404);

      const req = makeRequest({ method: 'POST' });
      const res = await POST(req);

      expect(res.status).toBe(500);
      consoleSpy.mockRestore();
    });

    it('should return 500 when the fetch to the provider throws a network error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockProviderNetworkFailure();

      const req = makeRequest({ method: 'POST' });
      const res = await POST(req);

      expect(res.status).toBe(500);
      consoleSpy.mockRestore();
    });

    it('should return 500 when provider responds with an empty deepLink', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockProviderOk(makeLinkResponse({ deepLink: '' }));

      const req = makeRequest({ method: 'POST' });
      const res = await POST(req);

      expect(res.status).toBe(500);
      consoleSpy.mockRestore();
    });

    it('should return 500 when provider responds with an empty requestId', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockProviderOk(makeLinkResponse({ requestId: '' }));

      const req = makeRequest({ method: 'POST' });
      const res = await POST(req);

      expect(res.status).toBe(500);
      consoleSpy.mockRestore();
    });

    it('should return 500 when provider response omits deepLink entirely', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockProviderOk(makeLinkResponse({ deepLink: undefined }));

      const req = makeRequest({ method: 'POST' });
      const res = await POST(req);

      expect(res.status).toBe(500);
      consoleSpy.mockRestore();
    });

    it('should return 500 when provider response omits requestId entirely', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockProviderOk(makeLinkResponse({ requestId: undefined }));

      const req = makeRequest({ method: 'POST' });
      const res = await POST(req);

      expect(res.status).toBe(500);
      consoleSpy.mockRestore();
    });
  });

  // ── QR code failures ──────────────────────────────────────────────────────

  it('should return 500 when QRCode.toDataURL throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockProviderOk();
    qrCodeMock.toDataURL.mockRejectedValueOnce(new Error('canvas error'));

    const req = makeRequest({ method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  describe('when sign-in initialization succeeds', () => {
    it('should return 200 on a successful request when initializing Diia sign-in', async () => {
      mockProviderOk();

      const req = makeRequest({ method: 'POST' });
      const res = await POST(req);

      expect(res.status).toBe(200);
    });

    it('should return the provider deep link when sign-in initialization succeeds', async () => {
      mockProviderOk();

      const req = makeRequest({ method: 'POST' });
      const { body } = await parseJson<any>(await POST(req));

      expect(body.deepLink).toBe(MOCK_DEEP_LINK);
    });

    it('should return the provider request ID when sign-in initialization succeeds', async () => {
      mockProviderOk();

      const req = makeRequest({ method: 'POST' });
      const { body } = await parseJson<any>(await POST(req));

      expect(body.requestId).toBe(MOCK_REQUEST_ID);
    });

    it('should return the generated sign-in QR code when initialization succeeds', async () => {
      mockProviderOk();

      const req = makeRequest({ method: 'POST' });
      const { body } = await parseJson<any>(await POST(req));

      expect(body.qrCode).toBe(MOCK_QR_DATA_URL);
    });

    it('should return an ISO expiration timestamp when sign-in initialization succeeds', async () => {
      mockProviderOk();

      const req = makeRequest({ method: 'POST' });
      const { body } = await parseJson<any>(await POST(req));

      expect(body.expiresAt).toBeDefined();
      expect(isNaN(new Date(body.expiresAt).getTime())).toBe(false);
    });

    it('should expire the sign-in link after the configured lifetime when initialization succeeds', async () => {
      mockProviderOk();

      const req = makeRequest({ method: 'POST' });
      const { body } = await parseJson<any>(await POST(req));

      expect(body.expiresAt).toBe(new Date(TEST_NOW + DIIA_LINK_TTL_MS).toISOString());
    });

    it('should generate the QR code from the provider deep link when initializing sign-in', async () => {
      mockProviderOk();

      const req = makeRequest({ method: 'POST' });
      await POST(req);

      expect(qrCodeMock.toDataURL).toHaveBeenCalledTimes(1);
      expect(qrCodeMock.toDataURL).toHaveBeenCalledWith(MOCK_DEEP_LINK, expect.any(Object));
    });

    it('should request a Diia sign-in link from the provider when initialization is requested', async () => {
      mockProviderOk();

      const req = makeRequest({ method: 'POST' });
      await POST(req);

      const calledUrl = String(fetchMock.mock.calls[0][0]);
      expect(calledUrl).toContain('/api/diia/app-link');
    });
  });
});
