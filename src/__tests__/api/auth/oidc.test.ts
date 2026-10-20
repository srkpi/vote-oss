import { NextRequest, NextResponse } from 'next/server';
import * as oidc from 'openid-client';
jest.mock('openid-client', () => ({ authorizationCodeGrant: jest.fn() }));
jest.mock('@/lib/kpi-oidc', () => ({
  getOidcConfig: jest.fn().mockResolvedValue({}),
  OIDC_COOKIE: 'kpi_oidc',
  OIDC_CALLBACK: 'https://example.com/api/auth/kpi-id/callback',
  oidcCookieOptions: { path: '/api/auth/kpi-id', httpOnly: true, sameSite: 'lax' },
  parseStudentClaims: jest.fn(),
}));
jest.mock('@/lib/redis', () => ({ redis: { getdel: jest.fn() } }));
jest.mock('@/lib/prisma', () => ({
  prisma: { kpiIdentity: { findUnique: jest.fn(), upsert: jest.fn() } },
}));
jest.mock('@/lib/kpi-id', () => ({ getCampusUserData: jest.fn() }));
jest.mock('@/lib/login-session', () => ({ completeLogin: jest.fn() }));
import { GET } from '@/app/api/auth/kpi-id/callback/route';
import { getCampusUserData } from '@/lib/kpi-id';
import { getOidcConfig, parseStudentClaims } from '@/lib/kpi-oidc';
import { completeLogin } from '@/lib/login-session';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
const handle = 'a'.repeat(64);
const student = { STUDENT_ID: 'new-record' };
const request = (cookie = handle) =>
  new NextRequest('https://untrusted-host.test/api/auth/kpi-id/callback?code=code&state=state', {
    headers: { cookie: 'kpi_oidc=' + cookie },
  });
describe('OIDC callback', () => {
  beforeEach(() => {
    (getOidcConfig as jest.Mock).mockResolvedValue({});
    (redis.getdel as jest.Mock).mockResolvedValue(
      JSON.stringify({ verifier: 'verifier', state: 'state', nonce: 'nonce' }),
    );
    (oidc.authorizationCodeGrant as jest.Mock).mockResolvedValue({
      claims: () => ({ sub: 'subject' }),
    });
    (parseStudentClaims as jest.Mock).mockReturnValue({ subject: 'subject', students: [student] });
    (prisma.kpiIdentity.findUnique as jest.Mock).mockResolvedValue({ user_id: 'old-record' });
    (prisma.kpiIdentity.upsert as jest.Mock).mockResolvedValue({ user_id: 'old-record' });
    (getCampusUserData as jest.Mock).mockResolvedValue({ userId: 'old-record' });
    (completeLogin as jest.Mock).mockImplementation(async () => {
      const response = NextResponse.json({ redirectTo: '/elections' });
      response.cookies.set('access_token', 'local-jwt', { httpOnly: true });
      return response;
    });
  });
  it('checks PKCE/state/nonce against the canonical callback and retains the existing user ID', async () => {
    const response = await GET(request());
    const [config, url, checks] = (oidc.authorizationCodeGrant as jest.Mock).mock.calls[0];
    expect(config).toEqual({});
    expect(url.href).toBe('https://example.com/api/auth/kpi-id/callback?code=code&state=state');
    expect(checks).toEqual({
      pkceCodeVerifier: 'verifier',
      expectedState: 'state',
      expectedNonce: 'nonce',
      idTokenExpected: true,
    });
    expect(redis.getdel).toHaveBeenCalledWith('oidc:' + handle);
    expect(completeLogin).toHaveBeenCalledWith(expect.anything(), student, 'old-record');
    expect(response.headers.get('location')).toBe('https://example.com/elections');
    expect(response.cookies.get('access_token')?.value).toBe('local-jwt');
    expect(response.cookies.get('kpi_oidc')?.maxAge).toBe(0);
  });
  it('rejects an expired or already consumed transaction', async () => {
    (redis.getdel as jest.Mock).mockResolvedValue(null);
    const response = await GET(request());
    expect(response.headers.get('location')).toContain('/login?error=kpi-id');
    expect(oidc.authorizationCodeGrant).not.toHaveBeenCalled();
    expect(completeLogin).not.toHaveBeenCalled();
  });
  it('rejects callbacks without a valid browser binding', async () => {
    await GET(request(''));
    expect(redis.getdel).not.toHaveBeenCalled();
    expect(completeLogin).not.toHaveBeenCalled();
  });
  it('handles provider errors without issuing a session', async () => {
    (oidc.authorizationCodeGrant as jest.Mock).mockRejectedValue(new Error('access_denied'));
    const response = await GET(request());
    expect(response.headers.get('location')).toContain('/login?error=kpi-id');
    expect(response.cookies.get('kpi_oidc')?.maxAge).toBe(0);
    expect(completeLogin).not.toHaveBeenCalled();
  });
  it('rejects untrusted claims before binding an account', async () => {
    (parseStudentClaims as jest.Mock).mockImplementation(() => {
      throw new Error('untrusted');
    });
    await GET(request());
    expect(prisma.kpiIdentity.upsert).not.toHaveBeenCalled();
    expect(completeLogin).not.toHaveBeenCalled();
  });
  it('tries later student records while keeping the bound account', async () => {
    const current = { STUDENT_ID: 'current-record' };
    (parseStudentClaims as jest.Mock).mockReturnValue({
      subject: 'subject',
      students: [student, current],
    });
    (getCampusUserData as jest.Mock)
      .mockResolvedValueOnce(NextResponse.json({}, { status: 403 }))
      .mockResolvedValueOnce({ userId: 'old-record' });
    await GET(request());
    expect(completeLogin).toHaveBeenCalledWith(expect.anything(), current, 'old-record');
  });
  it('refuses an identity conflict instead of issuing another account', async () => {
    (prisma.kpiIdentity.upsert as jest.Mock).mockRejectedValue(new Error('unique constraint'));
    const response = await GET(request());
    expect(response.headers.get('location')).toContain('/login?error=kpi-id');
    expect(completeLogin).not.toHaveBeenCalled();
  });
});
