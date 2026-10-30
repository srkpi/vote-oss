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
  getCachedAdmins: vi.fn().mockResolvedValue(null),
}));

import { POST } from '@/app/api/elections/[id]/restore/route';

const PARAMS = { params: Promise.resolve({ id: MOCK_ELECTION_ID }) };

// ── Request builders ────────────────────────────────────────────────────────

async function adminReq(adminRecord = ADMIN_RECORD) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'POST' });
}

async function restrictedAdminReq(adminRecord = RESTRICTED_ADMIN_RECORD) {
  const { access } = await makeTokenPair(RESTRICTED_ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'POST' });
}

/**
 * Mock the admin graph (superadmin-001 → root, admin-002 → promoted by superadmin-001).
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

describe('Restoring an election (POST /api/elections/[id]/restore)', () => {
  beforeEach(() => {
    allure.feature('Elections');
    allure.story('Restore Election');
  });

  // ── Auth & param validation ─────────────────────────────────────────────

  describe('when validating caller access and the election identifier', () => {
    it('should return 401 when no user is signed in', async () => {
      const req = makeRequest({ method: 'POST' });
      const res = await POST(req, PARAMS);
      expect(res.status).toBe(401);
    });

    it('should return 403 when the signed-in user is not an admin', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
      const req = makeAuthRequest(access.token, { method: 'POST' });
      const res = await POST(req, PARAMS);
      expect(res.status).toBe(403);
    });

    it('should return 400 for a non-uuid election id when restoring an election', async () => {
      const req = await adminReq();
      const res = await POST(req, { params: Promise.resolve({ id: 'bad-id' }) });
      expect(res.status).toBe(400);
    });

    it('should return 404 when election does not exist', async () => {
      const req = await adminReq();
      prismaMock.election.findUnique.mockResolvedValueOnce(null);
      const res = await POST(req, PARAMS);
      expect(res.status).toBe(404);
    });

    it('should return 400 when election is not deleted', async () => {
      const req = await adminReq();
      prismaMock.election.findUnique.mockResolvedValueOnce(makeElection()); // not deleted
      const res = await POST(req, PARAMS);
      expect(res.status).toBe(400);
    });
  });

  // ── Hierarchy checks ────────────────────────────────────────────────────

  describe('when checking the admin hierarchy', () => {
    it('should return 204 when unrestricted admin restores any deleted election', async () => {
      const req = await adminReq(ADMIN_RECORD); // superadmin-001, unrestricted
      prismaMock.election.findUnique.mockResolvedValueOnce(
        makeDeletedElection({ restrictions: [{ type: 'FACULTY', value: 'FICE' }] }, 'admin-002'),
      );
      mockAdminGraph();

      const res = await POST(req, PARAMS);
      expect(res.status).toBe(204);
    });

    it('should return 204 when the admin is restricted to a faculty restores an election they deleted themselves', async () => {
      const req = await restrictedAdminReq(); // admin-002
      prismaMock.election.findUnique.mockResolvedValueOnce(
        makeDeletedElection(
          { restrictions: [{ type: 'FACULTY', value: 'FICE' }] },
          'admin-002', // deleted by themselves
        ),
      );
      mockAdminGraph();

      const res = await POST(req, PARAMS);
      expect(res.status).toBe(204);
    });

    it('should return 403 when a faculty-limited admin tries to restore election deleted by their ancestor', async () => {
      // admin-002 cannot restore an election deleted by superadmin-001 (their ancestor, not subordinate)
      const req = await restrictedAdminReq(); // admin-002
      prismaMock.election.findUnique.mockResolvedValueOnce(
        makeDeletedElection(
          { restrictions: [{ type: 'FACULTY', value: 'FICE' }] },
          'superadmin-001', // deleted by ancestor
        ),
      );
      mockAdminGraph();

      const res = await POST(req, PARAMS);
      expect(res.status).toBe(403);
    });

    it('should return 204 when unrestricted admin restores election deleted by restricted admin', async () => {
      const req = await adminReq(ADMIN_RECORD); // superadmin-001
      prismaMock.election.findUnique.mockResolvedValueOnce(makeDeletedElection({}, 'admin-002'));
      mockAdminGraph();

      const res = await POST(req, PARAMS);
      expect(res.status).toBe(204);
    });
  });

  // ── Persistence ─────────────────────────────────────────────────────────

  describe('when restoring the saved election record', () => {
    it('should clear the deletion time and actor when restoring a deleted election', async () => {
      const req = await adminReq(ADMIN_RECORD);
      prismaMock.election.findUnique.mockResolvedValueOnce(makeDeletedElection());
      mockAdminGraph();

      await POST(req, PARAMS);

      expect(prismaMock.election.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MOCK_ELECTION_ID },
          data: { deleted_at: null, deleted_by: null },
        }),
      );
    });

    it('should invalidate the elections cache after restore', async () => {
      const { invalidateElections } = await vi.importMock('@/lib/cache');
      const req = await adminReq(ADMIN_RECORD);
      prismaMock.election.findUnique.mockResolvedValueOnce(makeDeletedElection());
      mockAdminGraph();

      await POST(req, PARAMS);

      expect(invalidateElections).toHaveBeenCalledTimes(1);
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────────

  it('should return 204 when unrestricted admin restores election with no faculty restriction', async () => {
    const req = await adminReq(ADMIN_RECORD);
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeDeletedElection({ restrictions: [] }), // global election
    );
    mockAdminGraph();

    const res = await POST(req, PARAMS);
    expect(res.status).toBe(204);
  });
});
