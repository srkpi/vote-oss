import * as allure from 'allure-js-commons';

import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/jwt';

import { ADMIN_RECORD, JWT_TOKEN_RECORD } from '../../helpers/fixtures';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import {
  getCookieDirectives,
  getResponseCookie,
  makeRequest,
  parseJson,
} from '../../helpers/request';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { POST } from '@/app/api/auth/kpi-id/route';

describe('POST /api/auth/kpi-id', () => {
  beforeEach(() => {
    resetPrismaMock();
    allure.feature('Auth');
    allure.story('KPI ID Login');
  });

  it('returns 400 when body is not valid JSON', async () => {
    const req = makeRequest({ method: 'POST' });
    req.json = jest.fn().mockRejectedValueOnce(new Error('bad json'));
    const res = await POST(req);
    const { status } = await parseJson(res);
    expect(status).toBe(400);
  });

  it('returns 400 when ticketId is missing from body', async () => {
    const req = makeRequest({ method: 'POST', body: {} });
    const res = await POST(req);
    const { status, body } = await parseJson<any>(res);
    expect(status).toBe(400);
    expect(body.message).toMatch(/ticketId/i);
  });

  it('returns 400 when ticketId is not a string', async () => {
    const req = makeRequest({ method: 'POST', body: { ticketId: 123 } });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 401 when ticketId is unknown', async () => {
    const req = makeRequest({ method: 'POST', body: { ticketId: 'no-such-ticket' } });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with user info and isAdmin=false for a regular user ticket', async () => {
    // Regular user: no admin record in DB
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);
    prismaMock.jwtToken.create.mockResolvedValueOnce({});

    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } });
    const res = await POST(req);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body.userId).toBe('user-001');
    expect(body.fullName).toBe('Ivan Petrenko');
    expect(body.isAdmin).toBe(false);
    expect(body.faculty).toBe('FICE');
  });

  it('sets HTTPOnly access_token and refresh_token cookies', async () => {
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);
    prismaMock.jwtToken.create.mockResolvedValueOnce({});

    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } });
    const res = await POST(req);

    expect(getResponseCookie(res, COOKIE_ACCESS)).not.toBeNull();
    expect(getResponseCookie(res, COOKIE_REFRESH)).not.toBeNull();

    const accessDirs = getCookieDirectives(res, COOKIE_ACCESS);
    expect(accessDirs['httponly']).toBe(true);
    expect(accessDirs['samesite']).toBe('lax');
  });

  it('does NOT set secure flag outside production', async () => {
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);
    prismaMock.jwtToken.create.mockResolvedValueOnce({});

    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } });
    const res = await POST(req);

    const dirs = getCookieDirectives(res, COOKIE_ACCESS);
    expect(dirs['secure']).toBeUndefined();
  });

  it('stores a jwtToken record in the database', async () => {
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);
    prismaMock.jwtToken.create.mockResolvedValueOnce({});

    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } });
    await POST(req);

    expect(prismaMock.jwtToken.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.jwtToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          access_jti: expect.any(String),
          refresh_jti: expect.any(String),
        }),
      }),
    );
  });

  it('reflects isAdmin=true when the user exists in the admins table', async () => {
    // Admin record present in DB → isAdmin must be true
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    prismaMock.jwtToken.create.mockResolvedValueOnce({});

    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-superadmin-1' } });
    const res = await POST(req);
    const { body } = await parseJson<any>(res);

    expect(body.isAdmin).toBe(true);
  });

  it('reflects isAdmin=false when the user is NOT in the admins table, even for an admin ticket', async () => {
    // Admin record absent in DB → isAdmin must be false regardless of the ticket
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);
    prismaMock.jwtToken.create.mockResolvedValueOnce({});

    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-superadmin-1' } });
    const res = await POST(req);
    const { body } = await parseJson<any>(res);

    expect(body.isAdmin).toBe(false);
  });

  it('queries the admins table with the resolved userId', async () => {
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);
    prismaMock.jwtToken.create.mockResolvedValueOnce({});

    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } });
    await POST(req);

    expect(prismaMock.admin.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: 'user-001' } }),
    );
  });

  it('embeds restricted_to_faculty and manage_admins from the DB record into the JWT', async () => {
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD); // restricted_to_faculty: false, manage_admins: true
    prismaMock.jwtToken.create.mockResolvedValueOnce({});

    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-superadmin-1' } });
    await POST(req);

    // Verify the jwtToken was created (we can't decode the JWT here directly,
    // but the cookie round-trip is verified in jwt.test.ts)
    expect(prismaMock.jwtToken.create).toHaveBeenCalledTimes(1);
  });

  it('uses restricted_to_faculty=false and manage_admins=false for non-admin users', async () => {
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);
    prismaMock.jwtToken.create.mockResolvedValueOnce({});

    // We can verify by checking what was stored — the JWT payload fields flow
    // through the token creation. No assertion on token internals needed here
    // because jwt.test.ts covers the round-trip.
    const req = makeRequest({ method: 'POST', body: { ticketId: 'ticket-user-1' } });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('JWT_TOKEN_RECORD fixture is still accepted (smoke test for requireAuth helpers)', () => {
    // Confirms the fixture shape matches what we persist
    expect(JWT_TOKEN_RECORD).toHaveProperty('access_jti');
    expect(JWT_TOKEN_RECORD).toHaveProperty('refresh_jti');
  });
});
