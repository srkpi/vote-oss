import { NextRequest } from 'next/server';
import * as oidc from 'openid-client';
jest.mock('openid-client', () => ({
  randomPKCECodeVerifier: jest.fn(),
  randomState: jest.fn(),
  randomNonce: jest.fn(),
  calculatePKCECodeChallenge: jest.fn(),
  buildAuthorizationUrl: jest.fn(),
}));
jest.mock('@/lib/kpi-oidc', () => ({
  getOidcConfig: jest.fn(),
  OIDC_CALLBACK: 'https://example.com/api/auth/kpi-id/callback',
  OIDC_COOKIE: 'kpi_oidc',
  OIDC_TTL: 300,
  oidcCookieOptions: {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/auth/kpi-id',
    maxAge: 300,
  },
}));
jest.mock('@/lib/redis', () => ({ redis: { set: jest.fn() } }));
jest.mock('@/lib/rate-limit', () => ({ getClientIp: jest.fn(), rateLimitLogin: jest.fn() }));
import { GET } from '@/app/api/auth/kpi-id/login/route';
import { getOidcConfig } from '@/lib/kpi-oidc';
import { rateLimitLogin } from '@/lib/rate-limit';
import { redis } from '@/lib/redis';
describe('OIDC initiation', () => {
  beforeEach(() => {
    (getOidcConfig as jest.Mock).mockResolvedValue({});
    (rateLimitLogin as jest.Mock).mockResolvedValue({ limited: false });
    (oidc.randomPKCECodeVerifier as jest.Mock).mockReturnValue('verifier');
    (oidc.randomState as jest.Mock).mockReturnValue('state');
    (oidc.randomNonce as jest.Mock).mockReturnValue('nonce');
    (oidc.calculatePKCECodeChallenge as jest.Mock).mockResolvedValue('challenge');
    (oidc.buildAuthorizationUrl as jest.Mock).mockReturnValue(
      new URL('https://auth.kpi.ua/authorize'),
    );
    (redis.set as jest.Mock).mockResolvedValue('OK');
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
    expect(cookie?.value).toMatch(/^[a-f0-9]{64}$/);
    expect(cookie?.httpOnly).toBe(true);
    expect(redis.set).toHaveBeenCalledWith(
      'oidc:' + cookie?.value,
      JSON.stringify({ verifier: 'verifier', state: 'state', nonce: 'nonce' }),
      'EX',
      300,
    );
    expect(response.headers.get('location')).toBe('https://auth.kpi.ua/authorize');
  });
  it('fails closed if Redis is unavailable', async () => {
    (redis.set as jest.Mock).mockRejectedValue(new Error('offline'));
    const response = await GET(new NextRequest('https://example.com/api/auth/kpi-id/login'));
    expect(response.headers.get('location')).toBe('https://example.com/login?error=kpi-id');
    expect(response.cookies.get('kpi_oidc')).toBeUndefined();
  });
  it('rate limits initiation before contacting the provider', async () => {
    (rateLimitLogin as jest.Mock).mockResolvedValue({ limited: true, resetInMs: 2000 });
    const response = await GET(new NextRequest('https://example.com/api/auth/kpi-id/login'));
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('2');
    expect(getOidcConfig).not.toHaveBeenCalled();
  });
});
