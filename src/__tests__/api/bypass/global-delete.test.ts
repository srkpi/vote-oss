import * as allure from 'allure-js-commons';

import {
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  JWT_TOKEN_RECORD,
  makeGlobalBypassToken,
  makeTokenPair,
  RESTRICTED_ADMIN_PAYLOAD,
  RESTRICTED_ADMIN_RECORD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRequest } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/cache', () => ({
  getCachedAdmins: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/redis', () => ({
  redis: { del: jest.fn().mockResolvedValue(1), get: jest.fn().mockResolvedValue(null) },
  safeRedis: jest.fn().mockImplementation((fn: () => unknown) => {
    try {
      return fn();
    } catch {
      return null;
    }
  }),
}));

import { DELETE } from '@/app/api/bypass/global/[tokenHash]/route';

const params = (hash: string) => ({ params: Promise.resolve({ tokenHash: hash }) });

async function adminReq() {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
  return makeAuthRequest(access.token, { method: 'DELETE' });
}

async function restrictedAdminReq() {
  const { access } = await makeTokenPair(RESTRICTED_ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
  return makeAuthRequest(access.token, { method: 'DELETE' });
}

describe('DELETE /api/bypass/global/[tokenHash]', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    allure.feature('Bypass');
    allure.story('Soft-Delete Global Bypass Token');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'DELETE' });
    const res = await DELETE(req, params('some-hash'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for restricted admin', async () => {
    const req = await restrictedAdminReq();
    const res = await DELETE(req, params('some-hash'));
    expect(res.status).toBe(403);
  });

  it('returns 404 when token does not exist', async () => {
    const req = await adminReq();
    prismaMock.globalBypassToken.findUnique.mockResolvedValueOnce(null);
    const res = await DELETE(req, params('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('returns 400 when token is already soft-deleted', async () => {
    const req = await adminReq();
    prismaMock.globalBypassToken.findUnique.mockResolvedValueOnce({
      ...makeGlobalBypassToken(),
      deleted_at: new Date(),
      usages: [],
    });
    const res = await DELETE(req, params('some-hash'));
    expect(res.status).toBe(400);
  });

  it('returns 204 when owner soft-deletes their token', async () => {
    const req = await adminReq();
    prismaMock.globalBypassToken.findUnique.mockResolvedValueOnce({
      ...makeGlobalBypassToken({ created_by: 'superadmin-001' }),
      deleted_at: null,
      usages: [],
    });

    const res = await DELETE(req, params('some-hash'));
    expect(res.status).toBe(204);
  });

  it('calls update with deleted_at instead of deleting the record', async () => {
    const req = await adminReq();
    prismaMock.globalBypassToken.findUnique.mockResolvedValueOnce({
      ...makeGlobalBypassToken({ created_by: 'superadmin-001' }),
      deleted_at: null,
      usages: [],
    });

    await DELETE(req, params('some-hash'));

    expect(prismaMock.globalBypassToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token_hash: 'some-hash' },
        data: { deleted_at: expect.any(Date) },
      }),
    );
    // Hard delete must NOT be called
    expect(prismaMock.globalBypassToken.delete).not.toHaveBeenCalled();
  });

  it('invalidates bypass cache for all users who used the token', async () => {
    const req = await adminReq();
    prismaMock.globalBypassToken.findUnique.mockResolvedValueOnce({
      ...makeGlobalBypassToken({ created_by: 'superadmin-001' }),
      deleted_at: null,
      usages: [{ user_id: 'user-001' }, { user_id: 'user-002' }],
    });

    const { safeRedis } = jest.requireMock('@/lib/redis');
    await DELETE(req, params('some-hash'));

    // Cache invalidation (redis.del) should have been triggered for each user
    expect(safeRedis).toHaveBeenCalled();
  });

  it('returns 403 when caller is not creator or ancestor of creator', async () => {
    const req = await adminReq();
    prismaMock.globalBypassToken.findUnique.mockResolvedValueOnce({
      ...makeGlobalBypassToken({ created_by: 'other-root-admin' }),
      deleted_at: null,
      usages: [],
    });
    // Graph: superadmin-001 is root, other-root-admin is an unrelated root
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
      { user_id: 'other-root-admin', promoted_by: null },
    ]);

    const res = await DELETE(req, params('some-hash'));
    expect(res.status).toBe(403);
  });
});
