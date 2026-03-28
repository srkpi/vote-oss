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
  RESTRICTED_ADMIN_RECORD,
  USER_PAYLOAD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRequest } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/cache', () => cacheMock);

import { PATCH } from '@/app/api/admins/[userId]/route';

/** Build an authenticated PATCH request as ADMIN_PAYLOAD with a mocked admin DB record. */
async function adminReq(body: object = {}, adminRecord = ADMIN_RECORD) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'PATCH', body });
}

const params = (userId: string) => ({ params: Promise.resolve({ userId }) });

describe('PATCH /api/admins/[userId]', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('Admins');
    allure.story('Update Admin Permissions');
  });

  // ── Auth guards ───────────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'PATCH' });
    const res = await PATCH(req, params('admin-002'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not an admin', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    const req = makeAuthRequest(access.token, { method: 'PATCH', body: {} });
    const res = await PATCH(req, params('admin-002'));
    expect(res.status).toBe(403);
  });

  it('returns 403 when the caller admin record has been soft-deleted', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(DELETED_ADMIN_RECORD);
    const req = makeAuthRequest(access.token, { method: 'PATCH', body: {} });
    const res = await PATCH(req, params('admin-002'));
    expect(res.status).toBe(403);
  });

  it('returns 403 when admin does not have manage_admins permission', async () => {
    const req = await adminReq({ manageAdmins: false }, { ...ADMIN_RECORD, manage_admins: false });
    const res = await PATCH(req, params('admin-002'));
    expect(res.status).toBe(403);
  });

  // ── Input validation ──────────────────────────────────────────────────────

  it('returns 400 when trying to modify yourself', async () => {
    const req = await adminReq({ manageAdmins: false });
    const res = await PATCH(req, params('superadmin-001'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when no permission fields are provided', async () => {
    const req = await adminReq({});
    const res = await PATCH(req, params('admin-002'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is not valid JSON', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    const req = makeAuthRequest(access.token, { method: 'PATCH' });
    req.json = jest.fn().mockRejectedValueOnce(new Error('bad json'));
    const res = await PATCH(req, params('admin-002'));
    expect(res.status).toBe(400);
  });

  // ── Faculty-restriction guard ─────────────────────────────────────────────

  it('returns 403 when restricted caller tries to grant restrictedToFaculty=false', async () => {
    const restrictedCaller = { ...ADMIN_RECORD, restricted_to_faculty: true };
    const req = await adminReq({ restrictedToFaculty: false }, restrictedCaller);
    const res = await PATCH(req, params('admin-002'));
    expect(res.status).toBe(403);
  });

  it('returns 204 when restricted caller sets restrictedToFaculty=true (allowed)', async () => {
    const restrictedCaller = { ...ADMIN_RECORD, restricted_to_faculty: true };
    const targetWithFalse = { ...RESTRICTED_ADMIN_RECORD, restricted_to_faculty: false };
    const req = await adminReq({ restrictedToFaculty: true }, restrictedCaller);
    prismaMock.admin.findUnique.mockResolvedValueOnce(targetWithFalse);
    cacheMock.getCachedAdmins.mockResolvedValueOnce([
      { ...ADMIN_API, restrictedToFaculty: true },
      RESTRICTED_ADMIN_API,
    ] as any);

    const res = await PATCH(req, params('admin-002'));
    expect(res.status).toBe(204);
  });

  // ── Target-admin lookup ───────────────────────────────────────────────────

  it('returns 404 when target admin does not exist', async () => {
    const req = await adminReq({ manageAdmins: false });
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);
    const res = await PATCH(req, params('nonexistent-admin'));
    expect(res.status).toBe(404);
  });

  it('returns 404 when target admin has been soft-deleted', async () => {
    const req = await adminReq({ manageAdmins: false });
    prismaMock.admin.findUnique.mockResolvedValueOnce(DELETED_ADMIN_RECORD);
    const res = await PATCH(req, params('admin-002'));
    expect(res.status).toBe(404);
  });

  // ── Hierarchy checks ──────────────────────────────────────────────────────

  it('returns 403 when caller is not an ancestor of the target', async () => {
    const req = await adminReq({ manageAdmins: false });
    prismaMock.admin.findUnique.mockResolvedValueOnce({
      ...RESTRICTED_ADMIN_RECORD,
      deleted_at: null,
    });
    cacheMock.getCachedAdmins.mockResolvedValueOnce([
      ADMIN_API,
      { ...RESTRICTED_ADMIN_API, userId: 'other-admin', promoter: null },
      { ...RESTRICTED_ADMIN_API, promoter: { userId: 'other-admin', fullName: 'Other Admin' } },
    ] as any);

    const res = await PATCH(req, params('admin-002'));
    expect(res.status).toBe(403);
  });

  it('falls back to prisma.admin.findMany when cache is empty for hierarchy', async () => {
    const req = await adminReq({ manageAdmins: false });
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    cacheMock.getCachedAdmins.mockResolvedValueOnce(null); // cache miss
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
      { user_id: 'admin-002', promoted_by: 'superadmin-001' },
    ]);

    const res = await PATCH(req, params('admin-002'));
    expect(res.status).toBe(204);
    expect(prismaMock.admin.findMany).toHaveBeenCalledTimes(1);
  });

  // ── Successful permission update ──────────────────────────────────────────

  it('returns 204 when hierarchy check passes and only manageAdmins provided', async () => {
    const req = await adminReq({ manageAdmins: false });
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

    const res = await PATCH(req, params('admin-002'));
    expect(res.status).toBe(204);
  });

  it('returns 204 when only restrictedToFaculty provided', async () => {
    const req = await adminReq({ restrictedToFaculty: false });
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

    const res = await PATCH(req, params('admin-002'));
    expect(res.status).toBe(204);
  });

  it('returns 204 when both manageAdmins and restrictedToFaculty provided', async () => {
    const req = await adminReq({ manageAdmins: true, restrictedToFaculty: false });
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

    const res = await PATCH(req, params('admin-002'));
    expect(res.status).toBe(204);
  });

  it('calls prisma.admin.update with the correct where and data when updating manageAdmins', async () => {
    const req = await adminReq({ manageAdmins: false });
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

    await PATCH(req, params('admin-002'));

    expect(prismaMock.admin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: 'admin-002' },
        data: { manage_admins: false },
      }),
    );
  });

  it('calls prisma.admin.update with only the supplied fields (no extra keys)', async () => {
    const req = await adminReq({ restrictedToFaculty: false });
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

    await PATCH(req, params('admin-002'));

    const updateCall = prismaMock.admin.update.mock.calls[0][0];
    expect(updateCall.data).toEqual({ restricted_to_faculty: false });
    expect(updateCall.data).not.toHaveProperty('manage_admins');
  });

  it('invalidates the admins cache after a successful update', async () => {
    const req = await adminReq({ manageAdmins: false });
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

    await PATCH(req, params('admin-002'));

    expect(cacheMock.invalidateAdmins).toHaveBeenCalledTimes(1);
  });

  // ── Invite-token cleanup: manage_admins change ────────────────────────────

  it('deletes ALL invite tokens when manage_admins changes (true → false)', async () => {
    // RESTRICTED_ADMIN_RECORD has manage_admins: true — changing to false
    const req = await adminReq({ manageAdmins: false });
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

    await PATCH(req, params('admin-002'));

    expect(prismaMock.adminInviteToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { created_by: 'admin-002' } }),
    );
  });

  it('deletes ALL invite tokens when manage_admins changes (false → true)', async () => {
    const targetWithoutManage = { ...RESTRICTED_ADMIN_RECORD, manage_admins: false };
    const req = await adminReq({ manageAdmins: true });
    prismaMock.admin.findUnique.mockResolvedValueOnce(targetWithoutManage);
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

    await PATCH(req, params('admin-002'));

    expect(prismaMock.adminInviteToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { created_by: 'admin-002' } }),
    );
  });

  it('invalidates invite-token cache when manage_admins changes', async () => {
    const req = await adminReq({ manageAdmins: false });
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

    await PATCH(req, params('admin-002'));

    expect(cacheMock.invalidateInviteTokens).toHaveBeenCalledTimes(1);
  });

  it('does NOT delete tokens when manage_admins value is the same (no actual change)', async () => {
    // RESTRICTED_ADMIN_RECORD.manage_admins === true → sending true is a no-op
    const req = await adminReq({ manageAdmins: true });
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

    await PATCH(req, params('admin-002'));

    expect(prismaMock.adminInviteToken.deleteMany).not.toHaveBeenCalled();
  });

  // ── Invite-token cleanup: restrictedToFaculty false → true ───────────────

  it('deletes only restricted_to_faculty=false tokens when restricted_to_faculty changes false→true', async () => {
    const unrestrictedTarget = { ...RESTRICTED_ADMIN_RECORD, restricted_to_faculty: false };
    const req = await adminReq({ restrictedToFaculty: true });
    prismaMock.admin.findUnique.mockResolvedValueOnce(unrestrictedTarget);
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

    await PATCH(req, params('admin-002'));

    expect(prismaMock.adminInviteToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { created_by: 'admin-002', restricted_to_faculty: false },
      }),
    );
  });

  it('invalidates invite-token cache when restricted_to_faculty changes false→true', async () => {
    const unrestrictedTarget = { ...RESTRICTED_ADMIN_RECORD, restricted_to_faculty: false };
    const req = await adminReq({ restrictedToFaculty: true });
    prismaMock.admin.findUnique.mockResolvedValueOnce(unrestrictedTarget);
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

    await PATCH(req, params('admin-002'));

    expect(cacheMock.invalidateInviteTokens).toHaveBeenCalledTimes(1);
  });

  it('does NOT delete tokens when restricted_to_faculty changes true→false', async () => {
    // Target is already restricted; setting to false doesn't warrant purge
    const req = await adminReq({ restrictedToFaculty: false });
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD); // restricted_to_faculty: true
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

    await PATCH(req, params('admin-002'));

    expect(prismaMock.adminInviteToken.deleteMany).not.toHaveBeenCalled();
  });

  it('does NOT delete tokens when restricted_to_faculty value is the same (no actual change)', async () => {
    // RESTRICTED_ADMIN_RECORD.restricted_to_faculty === true → sending true is a no-op
    const req = await adminReq({ restrictedToFaculty: true });
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

    await PATCH(req, params('admin-002'));

    expect(prismaMock.adminInviteToken.deleteMany).not.toHaveBeenCalled();
  });

  it('does NOT delete tokens when only restrictedToFaculty is updated and manage_admins is unchanged', async () => {
    const unrestrictedTarget = { ...RESTRICTED_ADMIN_RECORD, restricted_to_faculty: false };
    // Only restricted_to_faculty changes → should use the narrower delete (not the all-tokens delete)
    const req = await adminReq({ restrictedToFaculty: true });
    prismaMock.admin.findUnique.mockResolvedValueOnce(unrestrictedTarget);
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

    await PATCH(req, params('admin-002'));

    // Should call deleteMany exactly once, scoped to restricted_to_faculty: false
    expect(prismaMock.adminInviteToken.deleteMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.adminInviteToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { created_by: 'admin-002', restricted_to_faculty: false },
      }),
    );
  });

  // ── manage_admins change takes priority over restricted_to_faculty cleanup ─

  it('uses all-tokens deleteMany (not scoped) when manage_admins changes even if restricted_to_faculty also changes', async () => {
    const unrestrictedTarget = {
      ...RESTRICTED_ADMIN_RECORD,
      manage_admins: true,
      restricted_to_faculty: false,
    };
    const req = await adminReq({ manageAdmins: false, restrictedToFaculty: true });
    prismaMock.admin.findUnique.mockResolvedValueOnce(unrestrictedTarget);
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

    await PATCH(req, params('admin-002'));

    // The manage_admins branch fires first and deletes all tokens without a filter
    expect(prismaMock.adminInviteToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { created_by: 'admin-002' } }),
    );
    // The scoped delete (restricted_to_faculty: false) must NOT be called separately
    expect(prismaMock.adminInviteToken.deleteMany).toHaveBeenCalledTimes(1);
  });

  // ── No invite-token delete when nothing changes ───────────────────────────

  it('does not call adminInviteToken.deleteMany when no relevant permission changes', async () => {
    // Sending only restrictedToFaculty=false to an already-unrestricted admin
    const req = await adminReq({ restrictedToFaculty: false });
    prismaMock.admin.findUnique.mockResolvedValueOnce({
      ...RESTRICTED_ADMIN_RECORD,
      restricted_to_faculty: false,
    });
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

    await PATCH(req, params('admin-002'));

    expect(prismaMock.adminInviteToken.deleteMany).not.toHaveBeenCalled();
    expect(cacheMock.invalidateInviteTokens).not.toHaveBeenCalled();
  });

  // ── Graph built from cache (no N+1) ──────────────────────────────────────

  it('does not call prisma.admin.findMany when cached admins are available', async () => {
    const req = await adminReq({ manageAdmins: false });
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

    await PATCH(req, params('admin-002'));

    expect(prismaMock.admin.findMany).not.toHaveBeenCalled();
  });
});
