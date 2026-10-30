import { NextRequest, NextResponse } from 'next/server';
import * as oidc from 'openid-client';
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
vi.mock('openid-client', () => ({
  authorizationCodeGrant: vi.fn(),
  AuthorizationResponseError: class extends Error {},
}));
vi.mock('@/lib/kpi-oidc', () => ({
  getOidcConfig: vi.fn().mockResolvedValue({}),
  OIDC_COOKIE: 'kpi_oidc',
  OIDC_CALLBACK: 'https://example.com/api/auth/kpi-id/callback',
  oidcCookieOptions: { path: '/api/auth/kpi-id/callback', httpOnly: true, sameSite: 'lax' },
  parseStudentClaims: vi.fn(),
  openOidcTransaction: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: { kpiIdentity: { findUnique: vi.fn(), upsert: vi.fn() } },
}));
vi.mock('@/lib/kpi-id', () => ({ getCampusUserData: vi.fn() }));
vi.mock('@/lib/login-session', () => ({ completeLogin: vi.fn() }));
import { GET } from '@/app/api/auth/kpi-id/callback/route';
import { getCampusUserData } from '@/lib/kpi-id';
import { getOidcConfig, openOidcTransaction, parseStudentClaims } from '@/lib/kpi-oidc';
import { completeLogin } from '@/lib/login-session';
import { prisma } from '@/lib/prisma';
const handle = 'encrypted-transaction';
const student = { STUDENT_ID: 'new-record' };
const request = (cookie = handle) =>
  new NextRequest('https://untrusted-host.test/api/auth/kpi-id/callback?code=code&state=state', {
    headers: { cookie: 'kpi_oidc=' + cookie },
  });
describe('OIDC callback', () => {
  beforeEach(() => {
    (getOidcConfig as Mock).mockResolvedValue({});
    (openOidcTransaction as Mock).mockImplementation(async (cookie) => {
      if (!cookie) {
        throw new Error('Missing transaction');
      }
      return { verifier: 'verifier', state: 'state', nonce: 'nonce' };
    });
    (oidc.authorizationCodeGrant as Mock).mockResolvedValue({
      claims: () => ({ sub: 'subject' }),
    });
    (parseStudentClaims as Mock).mockReturnValue({ subject: 'subject', students: [student] });
    (prisma.kpiIdentity.findUnique as Mock).mockResolvedValue({ user_id: 'old-record' });
    (prisma.kpiIdentity.upsert as Mock).mockResolvedValue({ user_id: 'old-record' });
    (getCampusUserData as Mock).mockResolvedValue({ userId: 'old-record' });
    (completeLogin as Mock).mockImplementation(async () => {
      const response = NextResponse.redirect('https://example.com/elections');
      response.cookies.set('access_token', 'local-jwt', { httpOnly: true });
      return response;
    });
  });
  it('checks PKCE/state/nonce against the canonical callback and retains the existing user ID', async () => {
    const response = await GET(request());
    const [config, url, checks] = (oidc.authorizationCodeGrant as Mock).mock.calls[0];
    expect(config).toEqual({});
    expect(url.href).toBe('https://example.com/api/auth/kpi-id/callback?code=code&state=state');
    expect(checks).toEqual({
      pkceCodeVerifier: 'verifier',
      expectedState: 'state',
      expectedNonce: 'nonce',
      idTokenExpected: true,
    });
    expect(openOidcTransaction).toHaveBeenCalledWith(handle);
    expect(completeLogin).toHaveBeenCalledWith(expect.anything(), student, {
      userId: 'old-record',
      redirect: true,
    });
    expect(response.headers.get('location')).toBe('https://example.com/elections');
    expect(response.cookies.get('access_token')?.value).toBe('local-jwt');
    expect(response.cookies.get('kpi_oidc')?.maxAge).toBe(0);
  });
  it('rejects an expired or tampered transaction', async () => {
    (openOidcTransaction as Mock).mockRejectedValue(new Error('Expired transaction'));
    const response = await GET(request());
    expect(response.headers.get('location')).toContain('/login?error=kpi-id');
    expect(oidc.authorizationCodeGrant).not.toHaveBeenCalled();
    expect(completeLogin).not.toHaveBeenCalled();
  });
  it('rejects callbacks without a valid browser binding', async () => {
    await GET(request(''));
    expect(completeLogin).not.toHaveBeenCalled();
  });
  it('handles provider errors without issuing a session', async () => {
    (oidc.authorizationCodeGrant as Mock).mockRejectedValue(
      new oidc.AuthorizationResponseError('access_denied', {
        cause: new URLSearchParams({ error: 'access_denied' }),
      }),
    );
    const response = await GET(request());
    expect(response.headers.get('location')).toContain('/login?error=kpi-id');
    expect(response.cookies.get('kpi_oidc')?.maxAge).toBe(0);
    expect(completeLogin).not.toHaveBeenCalled();
  });
  it('rejects untrusted claims before binding an account', async () => {
    (parseStudentClaims as Mock).mockImplementation(() => {
      throw new Error('untrusted');
    });
    await GET(request());
    expect(prisma.kpiIdentity.upsert).not.toHaveBeenCalled();
    expect(completeLogin).not.toHaveBeenCalled();
  });
  it('tries later student records while keeping the bound account', async () => {
    const current = { STUDENT_ID: 'current-record' };
    (parseStudentClaims as Mock).mockReturnValue({
      subject: 'subject',
      students: [student, current],
    });
    (getCampusUserData as Mock)
      .mockResolvedValueOnce(NextResponse.json({}, { status: 403 }))
      .mockResolvedValueOnce({ userId: 'old-record' });
    await GET(request());
    expect(completeLogin).toHaveBeenCalledWith(expect.anything(), current, {
      userId: 'old-record',
      redirect: true,
    });
  });
  it('refuses an identity conflict instead of issuing another account', async () => {
    (prisma.kpiIdentity.upsert as Mock).mockRejectedValue(new Error('unique constraint'));
    const response = await GET(request());
    expect(response.headers.get('location')).toContain('/login?error=kpi-id');
    expect(completeLogin).not.toHaveBeenCalled();
  });
  it('preserves a valid transaction when a forged callback fails state validation', async () => {
    (oidc.authorizationCodeGrant as Mock).mockRejectedValue(new Error('state mismatch'));
    const response = await GET(request());
    expect(response.headers.get('location')).toContain('/login?error=kpi-id');
    expect(response.cookies.get('kpi_oidc')).toBeUndefined();
    expect(completeLogin).not.toHaveBeenCalled();
  });
});
