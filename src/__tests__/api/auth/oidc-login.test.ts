import { NextRequest } from 'next/server';
import * as oidc from 'openid-client';
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
vi.mock('openid-client', () => ({
  randomPKCECodeVerifier: vi.fn(),
  randomState: vi.fn(),
  randomNonce: vi.fn(),
  calculatePKCECodeChallenge: vi.fn(),
  buildAuthorizationUrl: vi.fn(),
}));
vi.mock('@/lib/kpi-oidc', () => ({
  getOidcConfig: vi.fn(),
  OIDC_CALLBACK: 'https://example.com/api/auth/kpi-id/callback',
  OIDC_COOKIE: 'kpi_oidc',
  sealOidcTransaction: vi.fn(),
  oidcCookieOptions: {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/auth/kpi-id/callback',
    maxAge: 900,
  },
}));
vi.mock('@/lib/rate-limit', () => ({ getClientIp: vi.fn(), rateLimitLogin: vi.fn() }));
import { GET } from '@/app/api/auth/kpi-id/login/route';
import { getOidcConfig, sealOidcTransaction } from '@/lib/kpi-oidc';
import { rateLimitLogin } from '@/lib/rate-limit';
describe('OIDC initiation', () => {
  beforeEach(() => {
    (getOidcConfig as Mock).mockResolvedValue({});
    (rateLimitLogin as Mock).mockResolvedValue({ limited: false });
    (oidc.randomPKCECodeVerifier as Mock).mockReturnValue('verifier');
    (oidc.randomState as Mock).mockReturnValue('state');
    (oidc.randomNonce as Mock).mockReturnValue('nonce');
    (oidc.calculatePKCECodeChallenge as Mock).mockResolvedValue('challenge');
    (oidc.buildAuthorizationUrl as Mock).mockReturnValue(new URL('https://auth.kpi.ua/authorize'));
    (sealOidcTransaction as Mock).mockResolvedValue('encrypted-transaction');
  });
  it('stores a short-lived browser-bound transaction and requests PKCE', async () => {
    const response = await GET(
      new NextRequest(
        'https://example.com/api/auth/kpi-id/login?iss=evil&target_link_uri=https://evil.test',
      ),
    );
    expect(oidc.buildAuthorizationUrl).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        redirect_uri: 'https://example.com/api/auth/kpi-id/callback',
        scope: 'openid profile student_ids',
        code_challenge: 'challenge',
        code_challenge_method: 'S256',
        state: 'state',
        nonce: 'nonce',
        prompt: 'login',
      }),
    );
    const cookie = response.cookies.get('kpi_oidc');
    expect(cookie?.value).toBe('encrypted-transaction');
    expect(cookie?.maxAge).toBe(900);
    expect(cookie?.path).toBe('/api/auth/kpi-id/callback');
    expect(cookie?.httpOnly).toBe(true);
    expect(sealOidcTransaction).toHaveBeenCalledWith({
      verifier: 'verifier',
      state: 'state',
      nonce: 'nonce',
    });
    expect(response.headers.get('location')).toBe('https://auth.kpi.ua/authorize');
  });
  it('does not redirect to KPI ID if the transaction cannot be sealed', async () => {
    (sealOidcTransaction as Mock).mockRejectedValue(new Error('encryption failed'));
    const response = await GET(new NextRequest('https://example.com/api/auth/kpi-id/login'));
    expect(response.headers.get('location')).toBe('https://example.com/login?error=kpi-id');
    expect(response.cookies.get('kpi_oidc')).toBeUndefined();
  });
  it('rate limits initiation before contacting the provider', async () => {
    (rateLimitLogin as Mock).mockResolvedValue({ limited: true, resetInMs: 2000 });
    const response = await GET(new NextRequest('https://example.com/api/auth/kpi-id/login'));
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('2');
    expect(getOidcConfig).not.toHaveBeenCalled();
  });
});
