import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { cacheMock, resetCacheMock } from '@/__tests__/helpers/cache-mock';
import {
  ADMIN_API,
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  DELETED_ADMIN_RECORD,
  JWT_TOKEN_RECORD,
  makeTokenPair,
  RESTRICTED_ADMIN_API,
  RESTRICTED_ADMIN_RECORD,
  USER_PAYLOAD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRequest } from '@/__tests__/helpers/request';
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

import { DELETE } from '@/app/api/admins/[userId]/route';

async function adminReq(adminRecord = ADMIN_RECORD) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'DELETE' });
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

describe('Removing an admin (DELETE /api/admins/[userId])', () => {
  beforeEach(() => {
    allure.feature('Admins');
    allure.story('Delete Admin');
  });

  // ── Auth guards ───────────────────────────────────────────────────────────

  describe('when checking caller access', () => {
    it('should return 401 when no user is signed in', async () => {
      const req = makeRequest({ method: 'DELETE' });
      const res = await DELETE(req, { params: Promise.resolve({ userId: 'user-002' }) });
      expect(res.status).toBe(401);
    });

    it('should return 403 when the signed-in user is not an admin', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
      const req = makeAuthRequest(access.token, { method: 'DELETE' });
      const res = await DELETE(req, { params: Promise.resolve({ userId: 'user-002' }) });
      expect(res.status).toBe(403);
    });

    it('should return 403 when the caller is no longer an active admin', async () => {
      const { access } = await makeTokenPair(ADMIN_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
      prismaMock.admin.findUnique.mockResolvedValueOnce(DELETED_ADMIN_RECORD);
      const req = makeAuthRequest(access.token, { method: 'DELETE' });
      const res = await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });
      expect(res.status).toBe(403);
    });

    it('should return 403 when the admin cannot manage other admins', async () => {
      const req = await adminReq({ ...ADMIN_RECORD, manage_admins: false });
      const res = await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });
      expect(res.status).toBe(403);
    });
  });

  // ── Input validation ──────────────────────────────────────────────────────

  it('should return 400 when trying to delete yourself', async () => {
    const req = await adminReq(ADMIN_RECORD);
    const res = await DELETE(req, { params: Promise.resolve({ userId: 'superadmin-001' }) });
    expect(res.status).toBe(400);
  });

  // ── Target-admin lookup ───────────────────────────────────────────────────

  describe('when finding the target admin', () => {
    it('should return 404 when target admin does not exist', async () => {
      const req = await adminReq(ADMIN_RECORD);
      prismaMock.admin.findUnique.mockResolvedValueOnce(null);
      const res = await DELETE(req, { params: Promise.resolve({ userId: 'nonexistent-admin' }) });
      expect(res.status).toBe(404);
    });

    it('should return 404 when target admin has already been soft-deleted', async () => {
      const req = await adminReq(ADMIN_RECORD);
      prismaMock.admin.findUnique.mockResolvedValueOnce(DELETED_ADMIN_RECORD);
      const res = await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });
      expect(res.status).toBe(404);
    });
  });

  // ── Hierarchy checks ──────────────────────────────────────────────────────

  describe('when checking the admin hierarchy', () => {
    it('should return 403 when caller is not an ancestor of the target', async () => {
      const { access } = await makeTokenPair(ADMIN_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
      prismaMock.admin.findUnique
        .mockResolvedValueOnce(ADMIN_RECORD)
        .mockResolvedValueOnce({ ...RESTRICTED_ADMIN_RECORD, deleted_at: null });
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        { ...RESTRICTED_ADMIN_API, userId: 'other-admin', promoter: null },
        { ...RESTRICTED_ADMIN_API, promoter: { userId: 'other-admin', fullName: 'Other Admin' } },
      ] as any);

      const req = makeAuthRequest(access.token, { method: 'DELETE' });
      const res = await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });
      expect(res.status).toBe(403);
    });

    it('should deny removal with 403 when a hierarchy cycle does not contain the caller', async () => {
      const { access } = await makeTokenPair(ADMIN_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
      prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD).mockResolvedValueOnce({
        ...RESTRICTED_ADMIN_RECORD,
        user_id: 'admin-x',
        deleted_at: null,
      });
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        {
          ...RESTRICTED_ADMIN_API,
          userId: 'admin-x',
          promoter: { userId: 'admin-y', fullName: 'Admin Y' },
        },
        {
          ...RESTRICTED_ADMIN_API,
          userId: 'admin-y',
          promoter: { userId: 'admin-x', fullName: 'Admin X' },
        },
      ] as any);

      const req = makeAuthRequest(access.token, { method: 'DELETE' });
      const res = await DELETE(req, { params: Promise.resolve({ userId: 'admin-x' }) });
      expect(res.status).toBe(403);
    });
  });

  // ── Successful soft-delete ────────────────────────────────────────────────

  describe('when admin removal succeeds', () => {
    it('should return 204 when hierarchy check passes', async () => {
      const req = await adminReq(ADMIN_RECORD);
      prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
      cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

      const res = await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });
      expect(res.status).toBe(204);
    });

    it('should mark the admin as deleted and record the removal actor when removal succeeds', async () => {
      const req = await adminReq(ADMIN_RECORD);
      prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
      cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

      await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });

      expect(prismaMock.admin.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 'admin-002' },
          data: expect.objectContaining({
            deleted_by: 'superadmin-001',
            deleted_at: expect.any(Date),
          }),
        }),
      );
    });

    it('should preserve the admin record when removing their access', async () => {
      const req = await adminReq(ADMIN_RECORD);
      prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
      cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

      await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });

      expect(prismaMock.admin.delete).not.toHaveBeenCalled();
    });

    it('should use the cached hierarchy when authorizing admin removal', async () => {
      const req = await adminReq(ADMIN_RECORD);
      prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
      cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

      await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });

      expect(prismaMock.admin.findMany).not.toHaveBeenCalled();
    });

    it('should invalidate the admins cache after a successful soft-delete', async () => {
      const req = await adminReq(ADMIN_RECORD);
      prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
      cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

      await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });

      expect(cacheMock.invalidateAdmins).toHaveBeenCalledTimes(1);
    });

    it('should invalidate the invite-tokens cache after a successful soft-delete', async () => {
      const req = await adminReq(ADMIN_RECORD);
      prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
      cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

      await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });

      expect(cacheMock.invalidateInviteTokens).toHaveBeenCalledTimes(1);
    });
  });

  // ── Children re-parenting ─────────────────────────────────────────────────

  describe('when transferring subordinates after admin removal', () => {
    it('should transfer direct subordinates to their grandparent when removing an admin', async () => {
      const req = await adminReq(ADMIN_RECORD);
      prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD); // target: promoter = superadmin-001
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        RESTRICTED_ADMIN_API,
        {
          ...RESTRICTED_ADMIN_API,
          userId: 'admin-leaf',
          promoter: { userId: 'admin-002', fullName: 'Faculty Admin FICE' },
        },
      ] as any);

      await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });

      expect(prismaMock.admin.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { promoted_by: 'admin-002' },
          data: { promoted_by: 'superadmin-001' }, // grandparent of the leaf
        }),
      );
    });

    it('should return 403 when attempting to delete a root admin (cannot be an ancestor of a root)', async () => {
      const req = await adminReq(ADMIN_RECORD);
      const rootTarget = { ...RESTRICTED_ADMIN_RECORD, promoted_by: null };
      prismaMock.admin.findUnique.mockResolvedValueOnce(rootTarget);
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        { ...RESTRICTED_ADMIN_API, promoter: null }, // admin-002 is also a root
        {
          ...RESTRICTED_ADMIN_API,
          userId: 'admin-leaf',
          promoter: { userId: 'admin-002', fullName: 'Faculty Admin FICE' },
        },
      ] as any);

      const res = await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });

      expect(res.status).toBe(403);
      expect(prismaMock.admin.updateMany).not.toHaveBeenCalled();
    });

    it('should transfer all direct subordinates in one bulk update when removing an admin', async () => {
      const req = await adminReq(ADMIN_RECORD);
      prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        RESTRICTED_ADMIN_API,
        {
          ...RESTRICTED_ADMIN_API,
          userId: 'admin-leaf-a',
          promoter: { userId: 'admin-002', fullName: 'Faculty Admin FICE' },
        },
        {
          ...RESTRICTED_ADMIN_API,
          userId: 'admin-leaf-b',
          promoter: { userId: 'admin-002', fullName: 'Faculty Admin FICE' },
        },
      ] as any);

      await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });

      expect(prismaMock.admin.updateMany).toHaveBeenCalledTimes(1);
    });
  });

  // ── Hierarchy preservation ────────────────────────────────────────────────

  it('should recognize ancestry through inactive admins when authorizing removal', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD).mockResolvedValueOnce({
      ...RESTRICTED_ADMIN_RECORD,
      user_id: 'admin-leaf',
      deleted_at: null,
    });
    cacheMock.getCachedAdmins.mockResolvedValueOnce([
      ADMIN_API,
      {
        ...RESTRICTED_ADMIN_API,
        userId: 'admin-middle',
        promoter: { userId: 'superadmin-001', fullName: 'Super Admin User' },
      },
      {
        ...RESTRICTED_ADMIN_API,
        userId: 'admin-leaf',
        promoter: { userId: 'admin-middle', fullName: 'Admin Middle' },
      },
    ] as any);

    const req = makeAuthRequest(access.token, { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ userId: 'admin-leaf' }) });
    expect(res.status).toBe(204);
  });
});
