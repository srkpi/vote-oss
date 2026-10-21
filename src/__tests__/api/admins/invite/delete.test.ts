import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { cacheMock, resetCacheMock } from '@/__tests__/helpers/cache-mock';
import {
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  JWT_TOKEN_RECORD,
  makeTokenPair,
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

import { DELETE as DELETE_BY_HASH } from '@/app/api/admins/invite/[tokenHash]/route';

const FUTURE = new Date(TEST_NOW + 86_400_000);

function makeTokenRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    token_hash: 'hash-abc',
    max_usage: 5,
    current_usage: 0,
    manage_admins: false,
    restricted_to_faculty: true,
    valid_due: FUTURE,
    created_at: new Date(),
    created_by: 'superadmin-001',
    ...overrides,
  };
}

async function adminReq(adminRecord = ADMIN_RECORD) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'DELETE' });
}

const params = (hash: string) => ({ params: Promise.resolve({ tokenHash: hash }) });

// ===========================================================================
// DELETE /api/admins/invite/[tokenHash]
// ===========================================================================

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetPrismaMock();
  resetTokenStoreMock();
  resetCacheMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Deleting an admin invitation (DELETE /api/admins/invite/[tokenHash])', () => {
  beforeEach(() => {
    allure.feature('Admins');
    allure.story('Delete Invite Token');
  });

  // ── Auth guards ───────────────────────────────────────────────────────────

  describe('when checking caller access', () => {
    it('should return 401 when no user is signed in', async () => {
      const req = makeRequest({ method: 'DELETE' });
      const res = await DELETE_BY_HASH(req, params('hash-abc'));
      expect(res.status).toBe(401);
    });

    it('should return 403 when the signed-in user is not an admin', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
      const req = makeAuthRequest(access.token, { method: 'DELETE' });
      const res = await DELETE_BY_HASH(req, params('hash-abc'));
      expect(res.status).toBe(403);
    });

    it('should return 403 when the admin cannot manage other admins', async () => {
      const req = await adminReq({ ...ADMIN_RECORD, manage_admins: false });
      const res = await DELETE_BY_HASH(req, params('hash-abc'));
      expect(res.status).toBe(403);
    });
  });

  // ── Token lookup ──────────────────────────────────────────────────────────

  it('should return 404 when token does not exist', async () => {
    const req = await adminReq();
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(null);
    const res = await DELETE_BY_HASH(req, params('nonexistent-hash'));
    expect(res.status).toBe(404);
  });

  // ── Owner deletes own token (no graph query needed) ───────────────────────

  describe('when the invitation creator deletes their invitation', () => {
    it('should return 204 when owner deletes their own token', async () => {
      const req = await adminReq();
      prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(
        makeTokenRecord({ created_by: 'superadmin-001' }),
      );
      prismaMock.adminInviteToken.delete.mockResolvedValueOnce({});

      const res = await DELETE_BY_HASH(req, params('hash-abc'));
      expect(res.status).toBe(204);
    });

    it('should skip the graph query when caller owns the token', async () => {
      const req = await adminReq();
      prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(
        makeTokenRecord({ created_by: 'superadmin-001' }),
      );
      prismaMock.adminInviteToken.delete.mockResolvedValueOnce({});

      await DELETE_BY_HASH(req, params('hash-abc'));

      expect(prismaMock.admin.findMany).not.toHaveBeenCalled();
    });
  });

  // ── Ancestor deletes subordinate's token ──────────────────────────────────

  describe('when an ancestor deletes a subordinate invitation', () => {
    it('should return 204 when ancestor deletes a subordinate token', async () => {
      const req = await adminReq();
      prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(
        makeTokenRecord({ created_by: 'admin-002' }),
      );
      prismaMock.admin.findMany.mockResolvedValueOnce([
        { user_id: 'superadmin-001', promoted_by: null },
        { user_id: 'admin-002', promoted_by: 'superadmin-001' },
      ]);
      prismaMock.adminInviteToken.delete.mockResolvedValueOnce({});

      const res = await DELETE_BY_HASH(req, params('hash-abc'));
      expect(res.status).toBe(204);
    });

    it('should load the hierarchy graph with a single findMany (no N+1) when deleting an admin invitation', async () => {
      const req = await adminReq();
      prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(
        makeTokenRecord({ created_by: 'admin-002' }),
      );
      prismaMock.admin.findMany.mockResolvedValueOnce([
        { user_id: 'superadmin-001', promoted_by: null },
        { user_id: 'admin-002', promoted_by: 'superadmin-001' },
      ]);
      prismaMock.adminInviteToken.delete.mockResolvedValueOnce({});

      await DELETE_BY_HASH(req, params('hash-abc'));

      expect(prismaMock.admin.findMany).toHaveBeenCalledTimes(1);
    });
  });

  // ── Non-ancestor forbidden ────────────────────────────────────────────────

  it('should return 403 when caller is not ancestor of token creator', async () => {
    const req = await adminReq();
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(
      makeTokenRecord({ created_by: 'other-admin' }),
    );
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
      { user_id: 'other-root', promoted_by: null },
      { user_id: 'other-admin', promoted_by: 'other-root' },
    ]);

    const res = await DELETE_BY_HASH(req, params('hash-abc'));
    expect(res.status).toBe(403);
  });

  // ── Cache invalidation ────────────────────────────────────────────────────

  it('should invalidate invite token cache after deletion', async () => {
    const req = await adminReq();
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(
      makeTokenRecord({ created_by: 'superadmin-001' }),
    );
    prismaMock.adminInviteToken.delete.mockResolvedValueOnce({});

    await DELETE_BY_HASH(req, params('hash-abc'));

    expect(cacheMock.invalidateInviteTokens).toHaveBeenCalledTimes(1);
  });
});
