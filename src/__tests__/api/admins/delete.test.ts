import * as allure from 'allure-js-commons';

import { cacheMock, resetCacheMock } from '../../helpers/cache-mock';
import {
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  DELETED_ADMIN_RECORD,
  JWT_TOKEN_RECORD,
  makeTokenPair,
  RESTRICTED_ADMIN_RECORD,
  USER_PAYLOAD,
} from '../../helpers/fixtures';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '../../helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '../../helpers/token-store-mock';

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
    // requireAdmin looks up the caller — return a soft-deleted record
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

  // ── Hierarchy checks (graph loaded via single findMany) ──────────────────

  it('returns 403 when caller is not an ancestor of the target', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique
      .mockResolvedValueOnce(ADMIN_RECORD) // requireAdmin
      .mockResolvedValueOnce({ ...RESTRICTED_ADMIN_RECORD, promoted_by: 'other-admin' }); // target
    // Graph: target is in a completely different branch — superadmin-001 is not an ancestor
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
      promoted_by: 'admin-y',
      deleted_at: null,
    });
    // Cycle: x → y → x; superadmin-001 is unreachable
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

  it('returns 200 with removedUserId when hierarchy check passes', async () => {
    const req = await adminReq(ADMIN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD); // target
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
      { user_id: 'admin-002', promoted_by: 'superadmin-001' },
    ]);
    prismaMock.admin.update.mockResolvedValueOnce({});

    const res = await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.removedUserId).toBe('admin-002');
  });

  it('soft-deletes the admin via update (not delete) with correct fields', async () => {
    const req = await adminReq(ADMIN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
      { user_id: 'admin-002', promoted_by: 'superadmin-001' },
    ]);
    prismaMock.admin.update.mockResolvedValueOnce({});

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
    prismaMock.admin.update.mockResolvedValueOnce({});

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
    prismaMock.admin.update.mockResolvedValueOnce({});

    await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });

    // Exactly one findMany for the graph — never more regardless of chain depth
    expect(prismaMock.admin.findMany).toHaveBeenCalledTimes(1);
  });

  it('invalidates the admins cache after a successful soft-delete', async () => {
    const req = await adminReq(ADMIN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
      { user_id: 'admin-002', promoted_by: 'superadmin-001' },
    ]);
    prismaMock.admin.update.mockResolvedValueOnce({});

    await DELETE(req, { params: Promise.resolve({ userId: 'admin-002' }) });

    expect(cacheMock.invalidateAdmins).toHaveBeenCalledTimes(1);
  });

  // ── Hierarchy preservation ────────────────────────────────────────────────

  it('traverses through a previously-deleted intermediary when checking ancestry', async () => {
    // Scenario: caller (superadmin-001) → admin-middle[deleted] → admin-leaf
    // The graph walk resolves ancestry through the deleted intermediary because
    // soft-delete never clears promoted_by, and fetchHierarchyGraph loads all nodes.
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique
      .mockResolvedValueOnce(ADMIN_RECORD) // requireAdmin (caller)
      .mockResolvedValueOnce({
        // target active-check: leaf is active
        ...RESTRICTED_ADMIN_RECORD,
        user_id: 'admin-leaf',
        promoted_by: 'admin-middle',
        deleted_at: null,
      });
    // Graph includes the soft-deleted intermediary
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
      { user_id: 'admin-middle', promoted_by: 'superadmin-001' }, // deleted but present
      { user_id: 'admin-leaf', promoted_by: 'admin-middle' },
    ]);
    prismaMock.admin.update.mockResolvedValueOnce({});

    const req = makeAuthRequest(access.token, { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ userId: 'admin-leaf' }) });
    expect(res.status).toBe(200);
  });
});
