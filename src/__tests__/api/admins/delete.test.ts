import * as allure from 'allure-js-commons';

import { cacheMock, resetCacheMock } from '@/__tests__/helpers/cache-mock';
import {
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  DELETED_ADMIN_RECORD,
  JWT_TOKEN_RECORD,
  makeTokenPair,
  RESTRICTED_ADMIN_RECORD,
  USER_PAYLOAD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRequest } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/cache', () => cacheMock);

import { DELETE } from '@/app/api/admins/[userId]/route';

async function adminReq(adminRecord = ADMIN_RECORD) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'DELETE' });
}

describe('DELETE /api/admins/[userId]', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('Admins');
    allure.story('Delete Admin');
  });

  // ── Auth guards ───────────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ userId: 'user-002' }) });
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not an admin', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    const req = makeAuthRequest(access.token, { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ userId: 'user-002' }) });
    expect(res.status).toBe(403);
  });

  it('returns 403 when the caller admin record has been soft-deleted', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(DELETED_ADMIN_RECORD);
    const req = makeAuthRequest(access.token, { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });
    expect(res.status).toBe(403);
  });

  it('returns 403 when admin does not have manage_admins permission', async () => {
    const req = await adminReq({ ...ADMIN_RECORD, manage_admins: false });
    const res = await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });
    expect(res.status).toBe(403);
  });

  // ── Input validation ──────────────────────────────────────────────────────

  it('returns 400 when trying to delete yourself', async () => {
    const req = await adminReq(ADMIN_RECORD);
    const res = await DELETE(req, { params: Promise.resolve({ userId: 'superadmin-001' }) });
    expect(res.status).toBe(400);
  });

  // ── Target-admin lookup ───────────────────────────────────────────────────

  it('returns 404 when target admin does not exist', async () => {
    const req = await adminReq(ADMIN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);
    const res = await DELETE(req, { params: Promise.resolve({ userId: 'nonexistent-admin' }) });
    expect(res.status).toBe(404);
  });

  it('returns 404 when target admin has already been soft-deleted', async () => {
    const req = await adminReq(ADMIN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(DELETED_ADMIN_RECORD);
    const res = await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });
    expect(res.status).toBe(404);
  });

  // ── Hierarchy checks ──────────────────────────────────────────────────────

  it('returns 403 when caller is not an ancestor of the target', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD).mockResolvedValueOnce({
      ...RESTRICTED_ADMIN_RECORD,
      promoter: { user_id: 'other-admin', full_name: 'Other Admin' },
    });
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
      { user_id: 'other-admin', promoted_by: null },
      { user_id: 'admin-002', promoted_by: 'other-admin' },
    ]);

    const req = makeAuthRequest(access.token, { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });
    expect(res.status).toBe(403);
  });

  it('returns 403 for a cyclic graph (cycle guard fires, caller not found)', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD).mockResolvedValueOnce({
      ...RESTRICTED_ADMIN_RECORD,
      user_id: 'admin-x',
      promoter: { user_id: 'admin-y', full_name: 'Admin Y' },
      deleted_at: null,
    });
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
      { user_id: 'admin-x', promoted_by: 'admin-y' },
      { user_id: 'admin-y', promoted_by: 'admin-x' },
    ]);

    const req = makeAuthRequest(access.token, { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ userId: 'admin-x' }) });
    expect(res.status).toBe(403);
  });

  // ── Successful soft-delete ────────────────────────────────────────────────

  it('returns 204 when hierarchy check passes', async () => {
    const req = await adminReq(ADMIN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
      { user_id: 'admin-002', promoted_by: 'superadmin-001' },
    ]);

    const res = await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });
    expect(res.status).toBe(204);
  });

  it('soft-deletes the admin via update (not delete) with correct fields', async () => {
    const req = await adminReq(ADMIN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
      { user_id: 'admin-002', promoted_by: 'superadmin-001' },
    ]);

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

  it('does NOT call prisma.admin.delete (hard-delete is replaced by soft-delete)', async () => {
    const req = await adminReq(ADMIN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
      { user_id: 'admin-002', promoted_by: 'superadmin-001' },
    ]);

    await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });

    expect(prismaMock.admin.delete).not.toHaveBeenCalled();
  });

  it('loads the hierarchy graph with a single findMany call (no N+1)', async () => {
    const req = await adminReq(ADMIN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
      { user_id: 'admin-002', promoted_by: 'superadmin-001' },
    ]);

    await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });

    expect(prismaMock.admin.findMany).toHaveBeenCalledTimes(1);
  });

  it('invalidates the admins cache after a successful soft-delete', async () => {
    const req = await adminReq(ADMIN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
      { user_id: 'admin-002', promoted_by: 'superadmin-001' },
    ]);

    await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });

    expect(cacheMock.invalidateAdmins).toHaveBeenCalledTimes(1);
  });

  it('invalidates the invite-tokens cache after a successful soft-delete', async () => {
    const req = await adminReq(ADMIN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
      { user_id: 'admin-002', promoted_by: 'superadmin-001' },
    ]);

    await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });

    expect(cacheMock.invalidateInviteTokens).toHaveBeenCalledTimes(1);
  });

  // ── Children re-parenting ─────────────────────────────────────────────────

  it('re-parents direct children of deleted admin to their grandparent (fills hierarchy gap)', async () => {
    const req = await adminReq(ADMIN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD); // target: promoted_by = 'superadmin-001'
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
      { user_id: 'admin-002', promoted_by: 'superadmin-001' },
      { user_id: 'admin-leaf', promoted_by: 'admin-002' },
    ]);

    await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });

    expect(prismaMock.admin.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { promoted_by: 'admin-002' },
        data: { promoted_by: 'superadmin-001' }, // grandparent of the leaf
      }),
    );
  });

  it('returns 403 when attempting to delete a root admin (cannot be an ancestor of a root)', async () => {
    const req = await adminReq(ADMIN_RECORD);
    const rootTarget = { ...RESTRICTED_ADMIN_RECORD, promoted_by: null };
    prismaMock.admin.findUnique.mockResolvedValueOnce(rootTarget);
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
      { user_id: 'admin-002', promoted_by: null },
      { user_id: 'admin-leaf', promoted_by: 'admin-002' },
    ]);

    const res = await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });

    expect(res.status).toBe(403);
    expect(prismaMock.admin.updateMany).not.toHaveBeenCalled();
  });

  it('uses a single updateMany for child re-parenting (no N+1)', async () => {
    const req = await adminReq(ADMIN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
      { user_id: 'admin-002', promoted_by: 'superadmin-001' },
      { user_id: 'admin-leaf-a', promoted_by: 'admin-002' },
      { user_id: 'admin-leaf-b', promoted_by: 'admin-002' },
    ]);

    await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });

    expect(prismaMock.admin.updateMany).toHaveBeenCalledTimes(1);
  });

  // ── Hierarchy preservation ────────────────────────────────────────────────

  it('traverses through a previously-deleted intermediary when checking ancestry', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD).mockResolvedValueOnce({
      ...RESTRICTED_ADMIN_RECORD,
      user_id: 'admin-leaf',
      promoter: { user_id: 'admin-middle', full_name: 'Admin Middle' },
      deleted_at: null,
    });
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
      { user_id: 'admin-middle', promoted_by: 'superadmin-001' },
      { user_id: 'admin-leaf', promoted_by: 'admin-middle' },
    ]);

    const req = makeAuthRequest(access.token, { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ userId: 'admin-leaf' }) });
    expect(res.status).toBe(204);
  });
});
