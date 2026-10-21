import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

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
import { TEST_NOW } from '@/__tests__/helpers/time';
import { resetTokenStoreMock } from '@/__tests__/helpers/token-store-mock';

vi.mock('@/lib/prisma', async () => {
  const { prismaMock } = await import('@/__tests__/helpers/prisma-mock');
  return { prisma: prismaMock };
});
vi.mock('@/lib/token-store', async () => {
  const { tokenStoreMock } = await import('@/__tests__/helpers/token-store-mock');
  return tokenStoreMock;
});
vi.mock('@/lib/cache', async () => {
  const { cacheMock } = await import('@/__tests__/helpers/cache-mock');
  return cacheMock;
});

import { GET } from '@/app/api/admins/[userId]/route';

async function adminReq(adminRecord = ADMIN_RECORD) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'GET' });
}

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetPrismaMock();
  resetTokenStoreMock();
  resetCacheMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Loading an admin profile (GET /api/admins/[userId])', () => {
  beforeEach(() => {
    allure.feature('Admins');
    allure.story('Get Admin');
  });

  it('should return 401 when no user is signed in', async () => {
    const req = makeRequest({ method: 'GET' });
    const res = await GET(req, { params: Promise.resolve({ userId: 'admin-002' }) });

    expect(res.status).toBe(401);
  });

  it('should return 403 when the signed-in user is not an admin', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);

    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);

    const req = makeAuthRequest(access.token, { method: 'GET' });

    const res = await GET(req, { params: Promise.resolve({ userId: 'admin-002' }) });

    expect(res.status).toBe(403);
  });

  it('should return 400 when userId param is missing', async () => {
    const req = await adminReq(ADMIN_RECORD);

    const res = await GET(req, { params: Promise.resolve({ userId: '' }) });

    expect(res.status).toBe(400);
  });

  // ── Cache-miss path (DB fallback) ─────────────────────────────────────────

  describe('when the admin cache is empty', () => {
    it('should return 404 when admin does not exist (cache miss, DB miss)', async () => {
      const req = await adminReq(ADMIN_RECORD);
      cacheMock.getCachedAdmins.mockResolvedValueOnce(null); // cache miss
      prismaMock.admin.findUnique.mockResolvedValueOnce(null);
      const res = await GET(req, { params: Promise.resolve({ userId: 'missing-admin' }) });

      expect(res.status).toBe(404);
    });

    it('should return 200 and the admin from DB when the cache is empty', async () => {
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

    it('should look up the requested admin by user ID when the admin cache is empty', async () => {
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

    it('should return 200 and the admin from cache without hitting the DB when loading an admin profile', async () => {
      const req = await adminReq(ADMIN_RECORD);
      cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API] as any);

      const res = await GET(req, { params: Promise.resolve({ userId: ADMIN_API.userId }) });
      const { status, body } = await parseJson<any>(res);

      expect(status).toBe(200);
      expect(body.userId).toBe(ADMIN_API.userId);
      // DB must NOT have been consulted for the lookup (only for requireAdmin's auth check)
      expect(prismaMock.admin.findUnique).toHaveBeenCalledTimes(1); // only requireAdmin call
    });

    it('should return 404 when cache is populated but target admin is absent', async () => {
      const req = await adminReq(ADMIN_RECORD);
      // Cache has records, but not the one we're looking for
      cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API] as any);

      const res = await GET(req, { params: Promise.resolve({ userId: 'nonexistent-admin' }) });

      expect(res.status).toBe(404);
      // No extra DB round-trip should happen
      expect(prismaMock.admin.findUnique).toHaveBeenCalledTimes(1); // only requireAdmin
    });

    it('should return promoter as an object with userId and fullName when loading an admin profile', async () => {
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
});
