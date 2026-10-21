import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

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
    deleted_by: null,
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

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetPrismaMock();
  resetTokenStoreMock();
  resetCacheMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Deleting an election bypass token (DELETE /api/bypass/election/[tokenHash])', () => {
  beforeEach(() => {
    allure.feature('Bypass');
    allure.story('Soft-Delete Election Bypass Token');
  });

  it('should return 401 when no user is signed in', async () => {
    const req = makeRequest({ method: 'DELETE' });
    const res = await DELETE(req, params('hash-abc'));
    expect(res.status).toBe(401);
  });

  it('should return 404 when token does not exist', async () => {
    const req = await adminReq();
    prismaMock.electionBypassToken.findUnique.mockResolvedValueOnce(null);
    const res = await DELETE(req, params('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('should return 400 when token is already soft-deleted', async () => {
    const req = await adminReq();
    prismaMock.electionBypassToken.findUnique.mockResolvedValueOnce(
      makeElectionBypassTokenRecord({ deleted_at: new Date(), deleted_by: 'superadmin-001' }),
    );
    const res = await DELETE(req, params('hash-abc'));
    expect(res.status).toBe(400);
  });

  it('should return 204 when owner soft-deletes their token', async () => {
    const req = await adminReq();
    prismaMock.electionBypassToken.findUnique.mockResolvedValueOnce(
      makeElectionBypassTokenRecord({ created_by: 'superadmin-001' }),
    );

    const res = await DELETE(req, params('hash-abc'));
    expect(res.status).toBe(204);
  });

  it('should preserve the token record and record its deletion actor when deleting an election bypass', async () => {
    const req = await adminReq();
    prismaMock.electionBypassToken.findUnique.mockResolvedValueOnce(
      makeElectionBypassTokenRecord({ created_by: 'superadmin-001' }),
    );

    await DELETE(req, params('hash-abc'));

    expect(prismaMock.electionBypassToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token_hash: 'hash-abc' },
        data: expect.objectContaining({
          deleted_at: expect.any(Date),
          deleted_by: 'superadmin-001',
        }),
      }),
    );
    expect(prismaMock.electionBypassToken.delete).not.toHaveBeenCalled();
  });

  it('should record the requesting admin as the deletion actor when removing a bypass token', async () => {
    const req = await adminReq();
    prismaMock.electionBypassToken.findUnique.mockResolvedValueOnce(
      makeElectionBypassTokenRecord({ created_by: 'superadmin-001' }),
    );

    await DELETE(req, params('hash-abc'));

    const updateCall = prismaMock.electionBypassToken.update.mock.calls[0][0];
    expect(updateCall.data.deleted_by).toBe('superadmin-001');
  });

  it('should mark all activations as revoked by the requesting admin when deleting a bypass token', async () => {
    const req = await adminReq();
    prismaMock.electionBypassToken.findUnique.mockResolvedValueOnce(
      makeElectionBypassTokenRecord({
        created_by: 'superadmin-001',
        usages: [{ user_id: 'user-001' }, { user_id: 'user-002' }],
      }),
    );

    await DELETE(req, params('hash-abc'));

    expect(prismaMock.electionBypassTokenUsage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token_hash: 'hash-abc' },
        data: expect.objectContaining({
          revoked_at: expect.any(Date),
          revoked_by: 'superadmin-001',
        }),
      }),
    );
  });

  it('should invalidate bypass cache for all users who activated the token when deleting an election bypass token', async () => {
    const req = await adminReq();
    prismaMock.electionBypassToken.findUnique.mockResolvedValueOnce(
      makeElectionBypassTokenRecord({
        created_by: 'superadmin-001',
        usages: [{ user_id: 'user-001' }, { user_id: 'user-002' }],
      }),
    );

    const { safeRedis } = await vi.importMock('@/lib/redis');
    await DELETE(req, params('hash-abc'));
    expect(safeRedis).toHaveBeenCalled();
  });

  it('should return 403 when caller is not creator or ancestor', async () => {
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

  it('should return 204 when ancestor deletes subordinate creator token', async () => {
    const req = await adminReq();
    prismaMock.electionBypassToken.findUnique.mockResolvedValueOnce(
      makeElectionBypassTokenRecord({ created_by: 'admin-002' }),
    );
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);
    const res = await DELETE(req, params('hash-abc'));
    expect(res.status).toBe(204);
  });
});
