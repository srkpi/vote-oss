import * as allure from 'allure-js-commons';

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
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/cache', () => cacheMock);

import { POST } from '@/app/api/admins/leave/route';

/** Build an authenticated request as ADMIN_PAYLOAD with a mocked admin DB record. */
async function adminReq(body: object = {}, adminRecord = ADMIN_RECORD) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'POST', body });
}

describe('POST /api/admins/leave', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('Admins');
    allure.story('Leave Platform');
  });

  // ── Auth guards ───────────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'POST', body: {} });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not an admin', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    const req = makeAuthRequest(access.token, { method: 'POST', body: {} });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 403 when the caller admin record has been soft-deleted', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(DELETED_ADMIN_RECORD);
    const req = makeAuthRequest(access.token, { method: 'POST', body: {} });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  // ── Single-admin guard ────────────────────────────────────────────────────

  it('returns 400 when the caller is the only active admin on the platform', async () => {
    const req = await adminReq({});
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API] as any);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // ── Subordinates-without-replacement guard ────────────────────────────────

  it('returns 400 when admin has direct children but no replacementId is provided', async () => {
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

  it('returns 400 when admin has indirect children only but no replacementId', async () => {
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

  // ── Replacement-admin validation ──────────────────────────────────────────

  it('returns 404 when replacementId does not exist in active admins', async () => {
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

  it('returns 400 when replacementId is not within the caller hierarchy branch', async () => {
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

  // ── Successful leave — no children ────────────────────────────────────────

  it('returns 204 when leaving with no children (replacementId null)', async () => {
    const req = await adminReq({ replacementId: null });
    cacheMock.getCachedAdmins.mockResolvedValueOnce([
      ADMIN_API,
      { ...RESTRICTED_ADMIN_API, userId: 'another-root', promoter: null },
    ] as any);
    const res = await POST(req);
    expect(res.status).toBe(204);
  });

  it('returns 204 when body is empty and admin has no children', async () => {
    const req = await adminReq({});
    cacheMock.getCachedAdmins.mockResolvedValueOnce([
      ADMIN_API,
      { ...RESTRICTED_ADMIN_API, userId: 'another-root', promoter: null },
    ] as any);
    const res = await POST(req);
    expect(res.status).toBe(204);
  });

  it('soft-deletes self with deleted_by equal to own userId when no children', async () => {
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

  it('does not call admin.updateMany when leaving with no children', async () => {
    const req = await adminReq({ replacementId: null });
    cacheMock.getCachedAdmins.mockResolvedValueOnce([
      ADMIN_API,
      { ...RESTRICTED_ADMIN_API, userId: 'another-root', promoter: null },
    ] as any);

    await POST(req);

    expect(prismaMock.admin.updateMany).not.toHaveBeenCalled();
  });

  // ── Successful leave — direct child replacement ────────────────────────────

  it('returns 204 when leaving with a direct child as replacement', async () => {
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

  it('moves the replacement to the caller position when it is a direct child', async () => {
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
        data: { promoted_by: null }, // inherits caller's position (root)
      }),
    );
  });

  it('re-parents sibling children under the replacement when it is a direct child', async () => {
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

  it('uses a single updateMany (no N+1) when replacement is a direct child', async () => {
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

  // ── Successful leave — indirect (non-direct) child replacement ────────────

  it('returns 204 when leaving with an indirect child as replacement', async () => {
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

  it('fills the replacement old spot by re-parenting its children upward (indirect case)', async () => {
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

  it('re-parents all caller direct children under the replacement (indirect case)', async () => {
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

  it('moves the replacement to the caller position (indirect case)', async () => {
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
        data: { promoted_by: null }, // caller was root → replacement inherits root position
      }),
    );
  });

  it('uses exactly two updateMany calls (no N+1) when replacement is indirect', async () => {
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

  // ── Self-deletion in all branches ─────────────────────────────────────────

  it('always soft-deletes self with deleted_by equal to own userId', async () => {
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

  it('deletes own invite tokens when leaving', async () => {
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

  // ── Cache invalidation ────────────────────────────────────────────────────

  it('invalidates both the admins and invite-tokens cache after leaving', async () => {
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

  it('does not call prisma.admin.findMany (active admins served from cache)', async () => {
    const req = await adminReq({ replacementId: null });
    cacheMock.getCachedAdmins.mockResolvedValueOnce([
      ADMIN_API,
      { ...RESTRICTED_ADMIN_API, userId: 'another-root', promoter: null },
    ] as any);

    await POST(req);

    expect(prismaMock.admin.findMany).not.toHaveBeenCalled();
  });

  it('falls back to prisma.admin.findMany when cache is empty', async () => {
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
