import * as allure from 'allure-js-commons';

import { cacheMock, resetCacheMock } from '@/__tests__/helpers/cache-mock';
import {
  ADMIN_API,
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  JWT_TOKEN_RECORD,
  makeTokenPair,
  MOCK_ELECTION_ID,
  RESTRICTED_ADMIN_API,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRequest } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/cache', () => cacheMock);
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

import { DELETE } from '@/app/api/bypass/election/[tokenHash]/route';

const params = (hash: string) => ({ params: Promise.resolve({ tokenHash: hash }) });

function makeElectionBypassTokenRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    token_hash: 'hash-abc',
    election_id: MOCK_ELECTION_ID,
    bypass_restrictions: ['FACULTY'],
    max_usage: 5,
    current_usage: 0,
    created_at: new Date(),
    deleted_at: null,
    created_by: 'superadmin-001',
    usages: [],
    ...overrides,
  };
}

async function adminReq() {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
  return makeAuthRequest(access.token, { method: 'DELETE' });
}

describe('DELETE /api/bypass/election/[tokenHash]', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('Bypass');
    allure.story('Soft-Delete Election Bypass Token');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'DELETE' });
    const res = await DELETE(req, params('hash-abc'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when token does not exist', async () => {
    const req = await adminReq();
    prismaMock.electionBypassToken.findUnique.mockResolvedValueOnce(null);
    const res = await DELETE(req, params('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('returns 400 when token is already soft-deleted', async () => {
    const req = await adminReq();
    prismaMock.electionBypassToken.findUnique.mockResolvedValueOnce(
      makeElectionBypassTokenRecord({ deleted_at: new Date() }),
    );
    const res = await DELETE(req, params('hash-abc'));
    expect(res.status).toBe(400);
  });

  it('returns 204 when owner soft-deletes their token', async () => {
    const req = await adminReq();
    prismaMock.electionBypassToken.findUnique.mockResolvedValueOnce(
      makeElectionBypassTokenRecord({ created_by: 'superadmin-001' }),
    );

    const res = await DELETE(req, params('hash-abc'));
    expect(res.status).toBe(204);
  });

  it('calls update with deleted_at instead of hard-deleting', async () => {
    const req = await adminReq();
    prismaMock.electionBypassToken.findUnique.mockResolvedValueOnce(
      makeElectionBypassTokenRecord({ created_by: 'superadmin-001' }),
    );

    await DELETE(req, params('hash-abc'));

    expect(prismaMock.electionBypassToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token_hash: 'hash-abc' },
        data: { deleted_at: expect.any(Date) },
      }),
    );
    expect(prismaMock.electionBypassToken.delete).not.toHaveBeenCalled();
  });

  it('invalidates bypass cache for all users who activated the token', async () => {
    const req = await adminReq();
    prismaMock.electionBypassToken.findUnique.mockResolvedValueOnce(
      makeElectionBypassTokenRecord({
        created_by: 'superadmin-001',
        usages: [{ user_id: 'user-001' }, { user_id: 'user-002' }],
      }),
    );

    const { safeRedis } = jest.requireMock('@/lib/redis');
    await DELETE(req, params('hash-abc'));
    expect(safeRedis).toHaveBeenCalled();
  });

  it('returns 403 when caller is not creator or ancestor', async () => {
    const req = await adminReq();
    prismaMock.electionBypassToken.findUnique.mockResolvedValueOnce(
      makeElectionBypassTokenRecord({ created_by: 'other-admin' }),
    );
    cacheMock.getCachedAdmins.mockResolvedValueOnce([
      { ...ADMIN_API },
      { ...RESTRICTED_ADMIN_API, userId: 'other-root', promoter: null },
      {
        ...RESTRICTED_ADMIN_API,
        userId: 'other-admin',
        promoter: { userId: 'other-root', fullName: 'Other' },
      },
    ] as any);

    const res = await DELETE(req, params('hash-abc'));
    expect(res.status).toBe(403);
  });

  it('returns 204 when ancestor deletes subordinate creator token', async () => {
    const req = await adminReq();
    // superadmin-001 is ancestor of admin-002
    prismaMock.electionBypassToken.findUnique.mockResolvedValueOnce(
      makeElectionBypassTokenRecord({ created_by: 'admin-002' }),
    );
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);
    const res = await DELETE(req, params('hash-abc'));
    expect(res.status).toBe(204);
  });
});
