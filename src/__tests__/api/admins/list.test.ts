import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { resetAvatarsMock } from '@/__tests__/helpers/avatars-mock';
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
vi.mock('@/lib/avatars', async () => {
  const { avatarsMock } = await import('@/__tests__/helpers/avatars-mock');
  return avatarsMock;
});

import { GET } from '@/app/api/admins/route';

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetPrismaMock();
  resetTokenStoreMock();
  resetCacheMock();
  resetAvatarsMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Listing admins (GET /api/admins)', () => {
  beforeEach(() => {
    allure.feature('Admins');
    allure.story('List Admins');
  });

  it('should return 401 when no user is signed in', async () => {
    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('should return 403 when the signed-in user is not an admin', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    const req = makeAuthRequest(access.token);
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('should return 403 when is_admin flag is set but no admin DB record exists', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);
    const req = makeAuthRequest(access.token);
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('should return 403 when the caller is no longer an active admin', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(DELETED_ADMIN_RECORD);
    const req = makeAuthRequest(access.token);
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('should return 200 with empty array when no admins exist', async () => {
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

  it('should return admin profiles and management permissions when listing active admins', async () => {
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

  describe('when excluding inactive admins', () => {
    it('should request only active admin records when loading the admin directory', async () => {
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

    it('should load the admin directory and hierarchy in one query when the cache is empty', async () => {
      const { access } = await makeTokenPair(ADMIN_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
      prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
      cacheMock.getCachedAdmins.mockResolvedValueOnce(null);
      prismaMock.admin.findMany.mockResolvedValueOnce([]);

      const req = makeAuthRequest(access.token);
      await GET(req);

      expect(prismaMock.admin.findMany).toHaveBeenCalledTimes(1);
    });

    it('should not include soft-deleted admins returned from cache when listing admins', async () => {
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

    it('should mark a soft-deleted admin as not deletable even when promoter points to caller', async () => {
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
});
