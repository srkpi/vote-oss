import * as allure from 'allure-js-commons';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { makeRequest, makeAuthRequest, parseJson } from '../../helpers/request';
import {
  makeTokenPair,
  USER_PAYLOAD,
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  RESTRICTED_ADMIN_RECORD,
  JWT_TOKEN_RECORD,
} from '../../helpers/fixtures';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { DELETE } from '@/app/api/admins/[userId]/route';

/**
 * Mocks requireAdmin internals for the requesting admin.
 */
async function adminReq(adminRecord = ADMIN_RECORD) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'DELETE' });
}

describe('DELETE /api/admins/[userId]', () => {
  beforeEach(() => {
    resetPrismaMock();
    allure.feature('Admins');
    allure.story('Delete Admin');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'DELETE' });
    const res = await DELETE(req, { params: { userId: 'user-002' } });
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not an admin', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    const req = makeAuthRequest(access.token, { method: 'DELETE' });
    const res = await DELETE(req, { params: { userId: 'user-002' } });
    expect(res.status).toBe(403);
  });

  it('returns 403 when admin does not have manage_admins permission', async () => {
    const req = await adminReq({ ...ADMIN_RECORD, manage_admins: false });
    const res = await DELETE(req, { params: { userId: 'admin-002' } });
    expect(res.status).toBe(403);
  });

  it('returns 400 when trying to delete yourself', async () => {
    const req = await adminReq(ADMIN_RECORD);
    // ADMIN_PAYLOAD.sub === ADMIN_RECORD.user_id === "superadmin-001"
    const res = await DELETE(req, { params: { userId: 'superadmin-001' } });
    expect(res.status).toBe(400);
  });

  it('returns 404 when target admin does not exist', async () => {
    const req = await adminReq(ADMIN_RECORD);
    // findUnique already used for requireAdmin; second call is for target
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);
    const res = await DELETE(req, { params: { userId: 'nonexistent-admin' } });
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not an ancestor of the target', async () => {
    await adminReq(ADMIN_RECORD);

    // Target exists
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);

    // Ancestor walk: RESTRICTED_ADMIN_RECORD.promoted_by = "superadmin-001" which IS our caller
    // But let's simulate a different branch to test the forbidden case
    // Override: target promoted_by = "other-admin"
    const targetInDifferentBranch = { ...RESTRICTED_ADMIN_RECORD, promoted_by: 'other-admin' };
    prismaMock.admin.findUnique.mockReset();
    // Re-setup: requireAdmin's findUnique for auth
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique
      .mockResolvedValueOnce(ADMIN_RECORD) // requireAdmin
      .mockResolvedValueOnce(targetInDifferentBranch) // target check
      .mockResolvedValueOnce({ promoted_by: null }); // ancestor walk hits root

    const reqFresh = makeAuthRequest(access.token, { method: 'DELETE' });
    const res = await DELETE(reqFresh, { params: { userId: 'admin-002' } });
    expect(res.status).toBe(403);
  });

  it('returns 200 and deletes the admin when hierarchy check passes', async () => {
    const req = await adminReq(ADMIN_RECORD);

    // Target admin whose promoted_by = "superadmin-001" (our caller)
    prismaMock.admin.findUnique
      .mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD) // target lookup
      .mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD); // ancestor walk (promoted_by = "superadmin-001")

    prismaMock.admin.delete.mockResolvedValueOnce({});

    const res = await DELETE(req, { params: { userId: 'admin-002' } });
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.removedUserId).toBe('admin-002');
  });

  it('calls prisma.admin.delete with the correct userId', async () => {
    const req = await adminReq(ADMIN_RECORD);

    prismaMock.admin.findUnique
      .mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD)
      .mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);

    prismaMock.admin.delete.mockResolvedValueOnce({});

    await DELETE(req, { params: { userId: 'admin-002' } });

    expect(prismaMock.admin.delete).toHaveBeenCalledWith({ where: { user_id: 'admin-002' } });
  });

  it('returns 403 for a deeply nested out-of-branch admin (cycle guard)', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique
      .mockResolvedValueOnce(ADMIN_RECORD) // requireAdmin
      .mockResolvedValueOnce({
        ...RESTRICTED_ADMIN_RECORD,
        user_id: 'admin-x',
        promoted_by: 'admin-y',
      }) // target
      .mockResolvedValueOnce({ promoted_by: 'admin-x' }) // cycle: x → y → x
      .mockResolvedValueOnce({ promoted_by: 'admin-y' }); // cycle guard fires

    const req = makeAuthRequest(access.token, { method: 'DELETE' });
    const res = await DELETE(req, { params: { userId: 'admin-x' } });
    expect(res.status).toBe(403);
  });
});
