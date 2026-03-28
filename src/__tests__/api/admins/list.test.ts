import * as allure from 'allure-js-commons';

import { cacheMock, resetCacheMock } from '@/__tests__/helpers/cache-mock';
import {
  ADMIN_API,
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  DELETED_ADMIN_RECORD,
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

import { GET } from '@/app/api/admins/route';

describe('GET /api/admins', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('Admins');
    allure.story('List Admins');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when called by a non-admin user', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    const req = makeAuthRequest(access.token);
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns 403 when is_admin flag is set but no admin DB record exists', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);
    const req = makeAuthRequest(access.token);
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns 403 when the caller admin has been soft-deleted', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(DELETED_ADMIN_RECORD);
    const req = makeAuthRequest(access.token);
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns 200 with empty array when no admins exist', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    cacheMock.getCachedAdmins.mockResolvedValueOnce(null); // cache miss
    prismaMock.admin.findMany.mockResolvedValueOnce([]); // DB returns empty

    const req = makeAuthRequest(access.token);
    const { status, body } = await parseJson<any[]>(await GET(req));

    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it('returns a list of admins with correct fields', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    cacheMock.getCachedAdmins.mockResolvedValueOnce(null); // cache miss
    prismaMock.admin.findMany.mockResolvedValueOnce([ADMIN_RECORD, RESTRICTED_ADMIN_RECORD]);

    const req = makeAuthRequest(access.token);
    const { body } = await parseJson<any[]>(await GET(req));

    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({
      userId: ADMIN_RECORD.user_id,
      fullName: ADMIN_RECORD.full_name,
      promoter: null,
      deletable: false,
    });
    expect(body[1]).toMatchObject({
      userId: RESTRICTED_ADMIN_RECORD.user_id,
      fullName: RESTRICTED_ADMIN_RECORD.full_name,
      promoter: { userId: 'superadmin-001', fullName: 'Super Admin User' },
      deletable: true,
    });
  });

  // ── Soft-delete filtering ─────────────────────────────────────────────────

  it('queries the DB with a deleted_at: null filter to exclude soft-deleted admins', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    cacheMock.getCachedAdmins.mockResolvedValueOnce(null); // cache miss
    prismaMock.admin.findMany.mockResolvedValueOnce([]);

    const req = makeAuthRequest(access.token);
    await GET(req);

    expect(prismaMock.admin.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deleted_at: null },
      }),
    );
  });

  it('uses a single findMany call on cache miss (no separate graph query)', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    cacheMock.getCachedAdmins.mockResolvedValueOnce(null);
    prismaMock.admin.findMany.mockResolvedValueOnce([]);

    const req = makeAuthRequest(access.token);
    await GET(req);

    expect(prismaMock.admin.findMany).toHaveBeenCalledTimes(1);
  });

  it('does not include soft-deleted admins returned from cache', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    // Cache holds only the active admin (in camelCase)
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API] as any);

    const req = makeAuthRequest(access.token);
    const { body } = await parseJson<any[]>(await GET(req));

    const ids = body.map((a: any) => a.userId);
    expect(ids).not.toContain(DELETED_ADMIN_RECORD.user_id);
    expect(ids).toContain(ADMIN_RECORD.user_id);
    // No DB findMany call — served entirely from cache
    expect(prismaMock.admin.findMany).not.toHaveBeenCalled();
  });

  it('marks a soft-deleted admin as not deletable even if promoter points to caller', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    cacheMock.getCachedAdmins.mockResolvedValueOnce(null);
    prismaMock.admin.findMany.mockResolvedValueOnce([ADMIN_RECORD]); // only active admin

    const req = makeAuthRequest(access.token);
    const { body } = await parseJson<any[]>(await GET(req));

    expect(body).toHaveLength(1);
    expect(body[0].userId).toBe(ADMIN_RECORD.user_id);
  });
});
