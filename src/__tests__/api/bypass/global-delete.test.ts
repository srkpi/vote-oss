import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

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
vi.mock('@/lib/cache', () => ({
  getCachedAdmins: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/redis', () => ({
  redis: { del: vi.fn().mockResolvedValue(1), get: vi.fn().mockResolvedValue(null) },
  safeRedis: vi.fn().mockImplementation((fn: () => unknown) => {
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

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetPrismaMock();
  resetTokenStoreMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Deleting a global bypass token (DELETE /api/bypass/global/[tokenHash])', () => {
  beforeEach(() => {
    allure.feature('Bypass');
    allure.story('Soft-Delete Global Bypass Token');
  });

  it('should return 401 when no user is signed in', async () => {
    const req = makeRequest({ method: 'DELETE' });
    const res = await DELETE(req, params('some-hash'));
    expect(res.status).toBe(401);
  });

  it('should return 403 when the admin is faculty-limited and deleting a global bypass token', async () => {
    const req = await restrictedAdminReq();
    const res = await DELETE(req, params('some-hash'));
    expect(res.status).toBe(403);
  });

  it('should return 404 when token does not exist', async () => {
    const req = await adminReq();
    prismaMock.globalBypassToken.findUnique.mockResolvedValueOnce(null);
    const res = await DELETE(req, params('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('should return 400 when token is already soft-deleted', async () => {
    const req = await adminReq();
    prismaMock.globalBypassToken.findUnique.mockResolvedValueOnce({
      ...makeGlobalBypassToken(),
      deleted_at: new Date(),
      deleted_by: 'superadmin-001',
      usages: [],
    });
    const res = await DELETE(req, params('some-hash'));
    expect(res.status).toBe(400);
  });

  it('should return 204 when owner soft-deletes their token', async () => {
    const req = await adminReq();
    prismaMock.globalBypassToken.findUnique.mockResolvedValueOnce({
      ...makeGlobalBypassToken({ created_by: 'superadmin-001' }),
      deleted_at: null,
      deleted_by: null,
      usages: [],
    });

    const res = await DELETE(req, params('some-hash'));
    expect(res.status).toBe(204);
  });

  it('should preserve the token record and record its deletion actor when deleting a global bypass', async () => {
    const req = await adminReq();
    prismaMock.globalBypassToken.findUnique.mockResolvedValueOnce({
      ...makeGlobalBypassToken({ created_by: 'superadmin-001' }),
      deleted_at: null,
      deleted_by: null,
      usages: [],
    });

    await DELETE(req, params('some-hash'));

    expect(prismaMock.globalBypassToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token_hash: 'some-hash' },
        data: expect.objectContaining({
          deleted_at: expect.any(Date),
          deleted_by: 'superadmin-001',
        }),
      }),
    );
    expect(prismaMock.globalBypassToken.delete).not.toHaveBeenCalled();
  });

  it('should record the requesting admin as the deletion actor when removing a bypass token', async () => {
    const req = await adminReq();
    prismaMock.globalBypassToken.findUnique.mockResolvedValueOnce({
      ...makeGlobalBypassToken({ created_by: 'superadmin-001' }),
      deleted_at: null,
      deleted_by: null,
      usages: [],
    });

    await DELETE(req, params('some-hash'));

    const updateCall = prismaMock.globalBypassToken.update.mock.calls[0][0];
    expect(updateCall.data.deleted_by).toBe('superadmin-001');
  });

  it('should mark all activations as revoked by the requesting admin when deleting a bypass token', async () => {
    const req = await adminReq();
    prismaMock.globalBypassToken.findUnique.mockResolvedValueOnce({
      ...makeGlobalBypassToken({ created_by: 'superadmin-001' }),
      deleted_at: null,
      deleted_by: null,
      usages: [{ user_id: 'user-001' }, { user_id: 'user-002' }],
    });

    await DELETE(req, params('some-hash'));

    expect(prismaMock.globalBypassTokenUsage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token_hash: 'some-hash' },
        data: expect.objectContaining({
          revoked_at: expect.any(Date),
          revoked_by: 'superadmin-001',
        }),
      }),
    );
  });

  it('should invalidate bypass cache for all users who used the token when deleting a global bypass token', async () => {
    const req = await adminReq();
    prismaMock.globalBypassToken.findUnique.mockResolvedValueOnce({
      ...makeGlobalBypassToken({ created_by: 'superadmin-001' }),
      deleted_at: null,
      deleted_by: null,
      usages: [{ user_id: 'user-001' }, { user_id: 'user-002' }],
    });

    const { safeRedis } = await vi.importMock('@/lib/redis');
    await DELETE(req, params('some-hash'));
    expect(safeRedis).toHaveBeenCalled();
  });

  it('should return 403 when caller is not creator or ancestor of creator', async () => {
    const req = await adminReq();
    prismaMock.globalBypassToken.findUnique.mockResolvedValueOnce({
      ...makeGlobalBypassToken({ created_by: 'other-root-admin' }),
      deleted_at: null,
      deleted_by: null,
      usages: [],
    });
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
      { user_id: 'other-root-admin', promoted_by: null },
    ]);

    const res = await DELETE(req, params('some-hash'));
    expect(res.status).toBe(403);
  });
});
