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

import { POST } from '@/app/api/admins/leave/route';

/** Build an authenticated request as ADMIN_PAYLOAD with a mocked admin DB record. */
async function adminReq(body: object = {}, adminRecord = ADMIN_RECORD) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'POST', body });
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

describe('Leaving the admin team (POST /api/admins/leave)', () => {
  beforeEach(() => {
    allure.feature('Admins');
    allure.story('Leave Platform');
  });

  // ── Auth guards ───────────────────────────────────────────────────────────

  describe('when checking caller access', () => {
    it('should return 401 when no user is signed in', async () => {
      const req = makeRequest({ method: 'POST', body: {} });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('should return 403 when the signed-in user is not an admin', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
      const req = makeAuthRequest(access.token, { method: 'POST', body: {} });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it('should return 403 when the caller is no longer an active admin', async () => {
      const { access } = await makeTokenPair(ADMIN_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
      prismaMock.admin.findUnique.mockResolvedValueOnce(DELETED_ADMIN_RECORD);
      const req = makeAuthRequest(access.token, { method: 'POST', body: {} });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });
  });

  // ── Single-admin guard ────────────────────────────────────────────────────

  it('should return 400 when the caller is the only active admin on the platform', async () => {
    const req = await adminReq({});
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API] as any);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // ── Subordinates-without-replacement guard ────────────────────────────────

  describe('when an admin with subordinates omits a replacement', () => {
    it('should return 400 when admin has direct children but no replacementId is provided', async () => {
      const req = await adminReq({});
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        {
          ...RESTRICTED_ADMIN_API,
          userId: 'admin-002',
          promoter: { userId: 'superadmin-001', fullName: 'Super Admin User' },
        },
        {
          ...RESTRICTED_ADMIN_API,
          userId: 'admin-003',
          promoter: { userId: 'superadmin-001', fullName: 'Super Admin User' },
        },
      ] as any);
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should return 400 when admin has indirect children only but no replacementId', async () => {
      const req = await adminReq({});
      // superadmin-001 → admin-002 → admin-leaf (superadmin-001 has a direct child)
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        {
          ...RESTRICTED_ADMIN_API,
          userId: 'admin-002',
          promoter: { userId: 'superadmin-001', fullName: 'Super Admin User' },
        },
        {
          ...RESTRICTED_ADMIN_API,
          userId: 'admin-leaf',
          promoter: { userId: 'admin-002', fullName: 'Faculty Admin FICE' },
        },
      ] as any);
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  // ── Replacement-admin validation ──────────────────────────────────────────

  describe('when selecting a replacement admin', () => {
    it('should return 404 when replacementId does not exist in active admins', async () => {
      const req = await adminReq({ replacementId: 'ghost-admin' });
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        {
          ...RESTRICTED_ADMIN_API,
          promoter: { userId: 'superadmin-001', fullName: 'Super Admin User' },
        },
      ] as any);
      const res = await POST(req);
      expect(res.status).toBe(404);
    });

    it('should return 400 when replacementId is not within the caller hierarchy branch', async () => {
      const req = await adminReq({ replacementId: 'other-admin' });
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        {
          ...RESTRICTED_ADMIN_API,
          promoter: { userId: 'superadmin-001', fullName: 'Super Admin User' },
        },
        { ...RESTRICTED_ADMIN_API, userId: 'other-root', promoter: null },
        {
          ...RESTRICTED_ADMIN_API,
          userId: 'other-admin',
          promoter: { userId: 'other-root', fullName: 'Other Root' },
        },
      ] as any);
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  // ── Successful leave — no children ────────────────────────────────────────

  describe('when leaving without subordinates', () => {
    it('should return 204 when leaving with no children (replacementId null)', async () => {
      const req = await adminReq({ replacementId: null });
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        { ...RESTRICTED_ADMIN_API, userId: 'another-root', promoter: null },
      ] as any);
      const res = await POST(req);
      expect(res.status).toBe(204);
    });

    it('should return 204 when body is empty and admin has no children', async () => {
      const req = await adminReq({});
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        { ...RESTRICTED_ADMIN_API, userId: 'another-root', promoter: null },
      ] as any);
      const res = await POST(req);
      expect(res.status).toBe(204);
    });

    it('should mark the caller as deleted by themselves when leaving without subordinates', async () => {
      const req = await adminReq({ replacementId: null });
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        { ...RESTRICTED_ADMIN_API, userId: 'another-root', promoter: null },
      ] as any);

      await POST(req);

      expect(prismaMock.admin.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 'superadmin-001' },
          data: expect.objectContaining({
            deleted_by: 'superadmin-001',
            deleted_at: expect.any(Date),
          }),
        }),
      );
    });

    it('should not call admin.updateMany when leaving with no children', async () => {
      const req = await adminReq({ replacementId: null });
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        { ...RESTRICTED_ADMIN_API, userId: 'another-root', promoter: null },
      ] as any);

      await POST(req);

      expect(prismaMock.admin.updateMany).not.toHaveBeenCalled();
    });
  });

  // ── Successful leave — direct child replacement ────────────────────────────

  describe('when choosing a direct subordinate as replacement', () => {
    it('should return 204 when leaving with a direct child as replacement', async () => {
      const req = await adminReq({ replacementId: 'admin-002' });
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        {
          ...RESTRICTED_ADMIN_API,
          promoter: { userId: 'superadmin-001', fullName: 'Super Admin User' },
        },
        {
          ...RESTRICTED_ADMIN_API,
          userId: 'admin-003',
          promoter: { userId: 'superadmin-001', fullName: 'Super Admin User' },
        },
      ] as any);
      const res = await POST(req);
      expect(res.status).toBe(204);
    });

    it('should move the replacement to the caller position when it is a direct child', async () => {
      const req = await adminReq({ replacementId: 'admin-002' });
      // superadmin-001 has promoted_by = null (root), so replacement moves to null
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        {
          ...RESTRICTED_ADMIN_API,
          promoter: { userId: 'superadmin-001', fullName: 'Super Admin User' },
        },
      ] as any);

      await POST(req);

      expect(prismaMock.admin.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 'admin-002' },
          data: { promoted_by: null, manage_admins: true, restricted_to_faculty: false }, // inherits caller's position (root)
        }),
      );
    });

    it('should reassign sibling children under the replacement when it is a direct child', async () => {
      const req = await adminReq({ replacementId: 'admin-002' });
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        {
          ...RESTRICTED_ADMIN_API,
          promoter: { userId: 'superadmin-001', fullName: 'Super Admin User' },
        },
        {
          ...RESTRICTED_ADMIN_API,
          userId: 'admin-003',
          promoter: { userId: 'superadmin-001', fullName: 'Super Admin User' },
        },
      ] as any);

      await POST(req);

      expect(prismaMock.admin.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { promoted_by: 'superadmin-001', user_id: { not: 'admin-002' } },
          data: { promoted_by: 'admin-002' },
        }),
      );
    });

    it('should transfer all sibling subordinates in one bulk update when choosing a direct replacement', async () => {
      const req = await adminReq({ replacementId: 'admin-002' });
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        {
          ...RESTRICTED_ADMIN_API,
          promoter: { userId: 'superadmin-001', fullName: 'Super Admin User' },
        },
        {
          ...RESTRICTED_ADMIN_API,
          userId: 'admin-003',
          promoter: { userId: 'superadmin-001', fullName: 'Super Admin User' },
        },
        {
          ...RESTRICTED_ADMIN_API,
          userId: 'admin-004',
          promoter: { userId: 'superadmin-001', fullName: 'Super Admin User' },
        },
      ] as any);

      await POST(req);

      expect(prismaMock.admin.updateMany).toHaveBeenCalledTimes(1);
    });
  });

  // ── Successful leave — indirect (non-direct) child replacement ────────────

  describe('when choosing an indirect subordinate as replacement', () => {
    it('should return 204 when leaving with an indirect child as replacement', async () => {
      const req = await adminReq({ replacementId: 'admin-leaf' });
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        {
          ...RESTRICTED_ADMIN_API,
          promoter: { userId: 'superadmin-001', fullName: 'Super Admin User' },
        },
        {
          ...RESTRICTED_ADMIN_API,
          userId: 'admin-leaf',
          promoter: { userId: 'admin-002', fullName: 'Faculty Admin FICE' },
        },
      ] as any);
      const res = await POST(req);
      expect(res.status).toBe(204);
    });

    it('should transfer the replacement subordinates to their former parent when promoting an indirect subordinate', async () => {
      const req = await adminReq({ replacementId: 'admin-leaf' });
      // admin-leaf has promoter = admin-002; its children should go to admin-002
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        {
          ...RESTRICTED_ADMIN_API,
          promoter: { userId: 'superadmin-001', fullName: 'Super Admin User' },
        },
        {
          ...RESTRICTED_ADMIN_API,
          userId: 'admin-leaf',
          promoter: { userId: 'admin-002', fullName: 'Faculty Admin FICE' },
        },
      ] as any);

      await POST(req);

      expect(prismaMock.admin.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { promoted_by: 'admin-leaf' },
          data: { promoted_by: 'admin-002' }, // replacement's original parent
        }),
      );
    });

    it('should transfer the departing admin subordinates to the replacement when promoting an indirect subordinate', async () => {
      const req = await adminReq({ replacementId: 'admin-leaf' });
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        {
          ...RESTRICTED_ADMIN_API,
          promoter: { userId: 'superadmin-001', fullName: 'Super Admin User' },
        },
        {
          ...RESTRICTED_ADMIN_API,
          userId: 'admin-leaf',
          promoter: { userId: 'admin-002', fullName: 'Faculty Admin FICE' },
        },
      ] as any);

      await POST(req);

      expect(prismaMock.admin.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { promoted_by: 'superadmin-001' },
          data: { promoted_by: 'admin-leaf' },
        }),
      );
    });

    it('should move the replacement into the departing admin position when promoting an indirect subordinate', async () => {
      const req = await adminReq({ replacementId: 'admin-leaf' });
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        {
          ...RESTRICTED_ADMIN_API,
          promoter: { userId: 'superadmin-001', fullName: 'Super Admin User' },
        },
        {
          ...RESTRICTED_ADMIN_API,
          userId: 'admin-leaf',
          promoter: { userId: 'admin-002', fullName: 'Faculty Admin FICE' },
        },
      ] as any);

      await POST(req);

      expect(prismaMock.admin.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 'admin-leaf' },
          data: { promoted_by: null, manage_admins: true, restricted_to_faculty: false }, // caller was root → replacement inherits root position
        }),
      );
    });

    it('should transfer both subordinate groups in two bulk updates when choosing an indirect replacement', async () => {
      const req = await adminReq({ replacementId: 'admin-leaf' });
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        {
          ...RESTRICTED_ADMIN_API,
          promoter: { userId: 'superadmin-001', fullName: 'Super Admin User' },
        },
        {
          ...RESTRICTED_ADMIN_API,
          userId: 'admin-leaf',
          promoter: { userId: 'admin-002', fullName: 'Faculty Admin FICE' },
        },
      ] as any);

      await POST(req);

      // One call to fill the replacement's old spot, one to re-parent caller's children
      expect(prismaMock.admin.updateMany).toHaveBeenCalledTimes(2);
    });
  });

  // ── Self-deletion in all branches ─────────────────────────────────────────

  describe('when recording the departing admin', () => {
    it('should record the departing admin as their own deletion actor when leaving', async () => {
      const req = await adminReq({ replacementId: 'admin-002' });
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        {
          ...RESTRICTED_ADMIN_API,
          promoter: { userId: 'superadmin-001', fullName: 'Super Admin User' },
        },
      ] as any);

      await POST(req);

      expect(prismaMock.admin.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 'superadmin-001' },
          data: expect.objectContaining({
            deleted_by: 'superadmin-001',
            deleted_at: expect.any(Date),
          }),
        }),
      );
    });

    it('should delete own invite tokens when leaving', async () => {
      const req = await adminReq({ replacementId: null });
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        { ...RESTRICTED_ADMIN_API, userId: 'another-root', promoter: null },
      ] as any);

      await POST(req);

      expect(prismaMock.adminInviteToken.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { created_by: 'superadmin-001' } }),
      );
    });
  });

  // ── Cache invalidation ────────────────────────────────────────────────────

  it('should invalidate both the admins and invite-tokens cache after leaving', async () => {
    const req = await adminReq({ replacementId: null });
    cacheMock.getCachedAdmins.mockResolvedValueOnce([
      ADMIN_API,
      { ...RESTRICTED_ADMIN_API, userId: 'another-root', promoter: null },
    ] as any);

    await POST(req);

    expect(cacheMock.invalidateAdmins).toHaveBeenCalledTimes(1);
    expect(cacheMock.invalidateInviteTokens).toHaveBeenCalledTimes(1);
  });

  // ── Query efficiency ──────────────────────────────────────────────────────

  describe('when limiting database work', () => {
    it('should not call prisma.admin.findMany (active admins served from cache) when leaving the admin team', async () => {
      const req = await adminReq({ replacementId: null });
      cacheMock.getCachedAdmins.mockResolvedValueOnce([
        ADMIN_API,
        { ...RESTRICTED_ADMIN_API, userId: 'another-root', promoter: null },
      ] as any);

      await POST(req);

      expect(prismaMock.admin.findMany).not.toHaveBeenCalled();
    });

    it('should fall back to prisma.admin.findMany when the cache is empty', async () => {
      const req = await adminReq({ replacementId: null });
      cacheMock.getCachedAdmins.mockResolvedValueOnce(null); // cache miss
      prismaMock.admin.findMany.mockResolvedValueOnce([
        { user_id: 'superadmin-001', promoted_by: null },
        { user_id: 'another-root', promoted_by: null },
      ]);

      const res = await POST(req);

      expect(res.status).toBe(204);
      expect(prismaMock.admin.findMany).toHaveBeenCalledTimes(1);
      expect(prismaMock.admin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deleted_at: null } }),
      );
    });
  });
});
