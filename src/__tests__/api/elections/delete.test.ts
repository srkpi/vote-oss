import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import {
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  JWT_TOKEN_RECORD,
  makeDeletedElection,
  makeElection,
  makeTokenPair,
  MOCK_ELECTION_ID,
  RESTRICTED_ADMIN_PAYLOAD,
  RESTRICTED_ADMIN_RECORD,
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
vi.mock('@/lib/cache', () => ({
  invalidateElections: vi.fn().mockResolvedValue(undefined),
  getCachedElections: vi.fn().mockResolvedValue(null),
  getCachedAdmins: vi.fn().mockResolvedValue(null),
}));

import { DELETE } from '@/app/api/elections/[id]/route';

const PARAMS = { params: Promise.resolve({ id: MOCK_ELECTION_ID }) };

// ── Request builders ────────────────────────────────────────────────────────

async function adminReq(adminRecord = ADMIN_RECORD) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'DELETE' });
}

async function restrictedAdminReq(adminRecord = RESTRICTED_ADMIN_RECORD) {
  const { access } = await makeTokenPair(RESTRICTED_ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'DELETE' });
}

/**
 * Mock the admin graph returned by prisma.admin.findMany (used by buildAdminGraph).
 * superadmin-001 (root) → admin-002 (subordinate)
 */
function mockAdminGraph() {
  prismaMock.admin.findMany.mockResolvedValueOnce([
    { user_id: 'superadmin-001', promoted_by: null },
    { user_id: 'admin-002', promoted_by: 'superadmin-001' },
  ]);
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetPrismaMock();
  resetTokenStoreMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Deleting an election (DELETE /api/elections/[id])', () => {
  beforeEach(() => {
    allure.feature('Elections');
    allure.story('Delete Election');
  });

  // ── Auth & param validation ─────────────────────────────────────────────

  describe('when validating caller access and the election identifier', () => {
    it('should return 401 when no user is signed in', async () => {
      const req = makeRequest({ method: 'DELETE' });
      const res = await DELETE(req, PARAMS);
      expect(res.status).toBe(401);
    });

    it('should return 403 when the signed-in user is not an admin', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
      const req = makeAuthRequest(access.token, { method: 'DELETE' });
      const res = await DELETE(req, PARAMS);
      expect(res.status).toBe(403);
    });

    it('should return 400 for a non-uuid election id when deleting an election', async () => {
      const req = await adminReq();
      const res = await DELETE(req, { params: Promise.resolve({ id: 'not-a-uuid' }) });
      expect(res.status).toBe(400);
    });

    it('should return 404 when election does not exist', async () => {
      const req = await adminReq();
      prismaMock.election.findUnique.mockResolvedValueOnce(null);
      const res = await DELETE(req, PARAMS);
      expect(res.status).toBe(404);
    });

    it('should return 404 when election is already soft-deleted', async () => {
      const req = await adminReq();
      prismaMock.election.findUnique.mockResolvedValueOnce(makeDeletedElection());
      const res = await DELETE(req, PARAMS);
      expect(res.status).toBe(404);
    });
  });

  // ── Hierarchy & faculty checks ──────────────────────────────────────────

  describe('when checking election management permissions', () => {
    it('should return 403 when a faculty-limited admin tries to delete an unrestricted election', async () => {
      const req = await restrictedAdminReq();
      // Election open to everyone (no faculty restriction)
      prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
      mockAdminGraph();
      const res = await DELETE(req, PARAMS);
      expect(res.status).toBe(403);
    });

    it('should return 403 when a faculty-limited admin tries to delete another faculty election', async () => {
      const req = await restrictedAdminReq();
      prismaMock.election.findUnique.mockResolvedValueOnce(
        makeElection({ restrictions: [{ type: 'FACULTY', value: 'FEL' }] }),
      );
      mockAdminGraph();
      const res = await DELETE(req, PARAMS);
      expect(res.status).toBe(403);
    });

    it('should return 403 when a faculty-limited admin tries to delete an election created by a peer (not subordinate)', async () => {
      // admin-002 tries to delete election created by superadmin-001, which is
      // an ancestor of admin-002, not a subordinate. Must be forbidden.
      const req = await restrictedAdminReq();
      prismaMock.election.findUnique.mockResolvedValueOnce(
        makeElection({
          created_by: 'superadmin-001', // creator is admin-002's ancestor, not subordinate
          restrictions: [{ type: 'FACULTY', value: 'FICE' }],
        }),
      );
      mockAdminGraph();
      const res = await DELETE(req, PARAMS);
      expect(res.status).toBe(403);
    });

    it('should return 204 when the admin is restricted to a faculty soft-deletes their own FICE election', async () => {
      const req = await restrictedAdminReq();
      prismaMock.election.findUnique.mockResolvedValueOnce(
        makeElection({
          created_by: 'admin-002', // same as requesting admin
          restrictions: [{ type: 'FACULTY', value: 'FICE' }],
        }),
      );
      mockAdminGraph();
      const res = await DELETE(req, PARAMS);
      expect(res.status).toBe(204);
    });

    it('should return 204 when unrestricted admin soft-deletes any election', async () => {
      const req = await adminReq(ADMIN_RECORD);
      prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
      mockAdminGraph();
      const res = await DELETE(req, PARAMS);
      expect(res.status).toBe(204);
    });

    it('should allow unrestricted admin to delete an open election when deleting an election', async () => {
      const req = await adminReq();
      prismaMock.election.findUnique.mockResolvedValueOnce(
        makeElection({
          opens_at: new Date(Date.now() - 3_600_000),
          closes_at: new Date(Date.now() + 3_600_000),
        }),
      );
      mockAdminGraph();
      const res = await DELETE(req, PARAMS);
      expect(res.status).toBe(204);
    });

    it('should allow unrestricted admin to delete a closed election when deleting an election', async () => {
      const req = await adminReq();
      prismaMock.election.findUnique.mockResolvedValueOnce(
        makeElection({
          opens_at: new Date(Date.now() - 7_200_000),
          closes_at: new Date(Date.now() - 100),
        }),
      );
      mockAdminGraph();
      const res = await DELETE(req, PARAMS);
      expect(res.status).toBe(204);
    });
  });

  // ── Soft delete behaviour ───────────────────────────────────────────────

  describe('when marking an election as deleted', () => {
    it('should preserve the election record when marking it as deleted', async () => {
      const req = await adminReq();
      prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
      mockAdminGraph();

      await DELETE(req, PARAMS);

      expect(prismaMock.election.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MOCK_ELECTION_ID },
          data: expect.objectContaining({ deleted_by: 'superadmin-001' }),
        }),
      );
      expect(prismaMock.election.delete).not.toHaveBeenCalled();
    });

    it('should record the current deletion time when marking an election as deleted', async () => {
      const before = new Date();
      const req = await adminReq();
      prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
      mockAdminGraph();

      await DELETE(req, PARAMS);

      const call = prismaMock.election.update.mock.calls[0][0];
      const deletedAt: Date = call.data.deleted_at;
      expect(deletedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('should invalidate the elections cache after soft deletion', async () => {
      const { invalidateElections } = await vi.importMock('@/lib/cache');
      const req = await adminReq();
      prismaMock.election.findUnique.mockResolvedValueOnce(makeElection());
      mockAdminGraph();

      await DELETE(req, PARAMS);

      expect(invalidateElections).toHaveBeenCalledTimes(1);
    });
  });

  // ── Hierarchy: superadmin can delete subordinate elections ──────────────

  it('should allow unrestricted superadmin to delete election created by restricted admin when deleting an election', async () => {
    const req = await adminReq(ADMIN_RECORD); // superadmin-001, unrestricted
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeElection({
        created_by: 'admin-002',
        restrictions: [{ type: 'FACULTY', value: 'FICE' }],
      }),
    );
    mockAdminGraph();
    const res = await DELETE(req, PARAMS);
    expect(res.status).toBe(204);
  });
});
