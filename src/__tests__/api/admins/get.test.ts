import * as allure from 'allure-js-commons';

import { cacheMock, resetCacheMock } from '@/__tests__/helpers/cache-mock';
import {
  ADMIN_API,
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  JWT_TOKEN_RECORD,
  makeTokenPair,
  RESTRICTED_ADMIN_RECORD,
  USER_PAYLOAD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/cache', () => cacheMock);

import { GET } from '@/app/api/admins/[userId]/route';

async function adminReq(adminRecord = ADMIN_RECORD) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'GET' });
}

describe('GET /api/admins/[userId]', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('Admins');
    allure.story('Get Admin');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'GET' });
    const res = await GET(req, { params: Promise.resolve({ userId: 'admin-002' }) });

    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not an admin', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);

    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);

    const req = makeAuthRequest(access.token, { method: 'GET' });

    const res = await GET(req, { params: Promise.resolve({ userId: 'admin-002' }) });

    expect(res.status).toBe(403);
  });

  it('returns 400 when userId param is missing', async () => {
    const req = await adminReq(ADMIN_RECORD);

    const res = await GET(req, { params: Promise.resolve({ userId: '' }) });

    expect(res.status).toBe(400);
  });

  // ── Cache-miss path (DB fallback) ─────────────────────────────────────────

  it('returns 404 when admin does not exist (cache miss, DB miss)', async () => {
    const req = await adminReq(ADMIN_RECORD);
    cacheMock.getCachedAdmins.mockResolvedValueOnce(null); // cache miss
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);
    const res = await GET(req, { params: Promise.resolve({ userId: 'missing-admin' }) });

    expect(res.status).toBe(404);
  });

  it('returns 200 and the admin from DB when cache is empty', async () => {
    const req = await adminReq(ADMIN_RECORD);
    cacheMock.getCachedAdmins.mockResolvedValueOnce(null); // cache miss
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    const res = await GET(req, { params: Promise.resolve({ userId: ADMIN_RECORD.user_id }) });
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body).toMatchObject({
      userId: ADMIN_RECORD.user_id,
      fullName: ADMIN_RECORD.full_name,
      promoter: null,
    });
  });

  it('calls prisma.admin.findUnique with the correct userId when cache is empty', async () => {
    const req = await adminReq(ADMIN_RECORD);
    cacheMock.getCachedAdmins.mockResolvedValueOnce(null);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);

    await GET(req, { params: Promise.resolve({ userId: 'admin-002' }) });

    expect(prismaMock.admin.findUnique).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { user_id: 'admin-002' },
      }),
    );
  });

  it('returns 200 and the admin from cache without hitting the DB', async () => {
    const req = await adminReq(ADMIN_RECORD);
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API] as any);

    const res = await GET(req, { params: Promise.resolve({ userId: ADMIN_API.userId }) });
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body.userId).toBe(ADMIN_API.userId);
    // DB must NOT have been consulted for the lookup (only for requireAdmin's auth check)
    expect(prismaMock.admin.findUnique).toHaveBeenCalledTimes(1); // only requireAdmin call
  });

  it('returns 404 when cache is populated but target admin is absent', async () => {
    const req = await adminReq(ADMIN_RECORD);
    // Cache has records, but not the one we're looking for
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API] as any);

    const res = await GET(req, { params: Promise.resolve({ userId: 'nonexistent-admin' }) });

    expect(res.status).toBe(404);
    // No extra DB round-trip should happen
    expect(prismaMock.admin.findUnique).toHaveBeenCalledTimes(1); // only requireAdmin
  });

  it('returns promoter as an object with userId and fullName', async () => {
    const req = await adminReq(ADMIN_RECORD);
    cacheMock.getCachedAdmins.mockResolvedValueOnce(null);
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);

    const res = await GET(req, {
      params: Promise.resolve({ userId: RESTRICTED_ADMIN_RECORD.user_id }),
    });
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body.promoter).toEqual({
      userId: 'superadmin-001',
      fullName: 'Super Admin User',
    });
  });
});
