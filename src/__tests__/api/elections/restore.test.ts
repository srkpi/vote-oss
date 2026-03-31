import * as allure from 'allure-js-commons';

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
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/cache', () => ({
  invalidateElections: jest.fn().mockResolvedValue(undefined),
  getCachedAdmins: jest.fn().mockResolvedValue(null),
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

describe('POST /api/elections/[id]/restore', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    allure.feature('Elections');
    allure.story('Restore Election');
  });

  // ── Auth & param validation ─────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'POST' });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not an admin', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    const req = makeAuthRequest(access.token, { method: 'POST' });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(403);
  });

  it('returns 400 for a non-uuid election id', async () => {
    const req = await adminReq();
    const res = await POST(req, { params: Promise.resolve({ id: 'bad-id' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when election does not exist', async () => {
    const req = await adminReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(null);
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(404);
  });

  it('returns 400 when election is not deleted', async () => {
    const req = await adminReq();
    prismaMock.election.findUnique.mockResolvedValueOnce(makeElection()); // not deleted
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(400);
  });

  // ── Hierarchy checks ────────────────────────────────────────────────────

  it('returns 204 when unrestricted admin restores any deleted election', async () => {
    const req = await adminReq(ADMIN_RECORD); // superadmin-001, unrestricted
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeDeletedElection({ restrictions: [{ type: 'FACULTY', value: 'FICE' }] }, 'admin-002'),
    );
    mockAdminGraph();

    const res = await POST(req, PARAMS);
    expect(res.status).toBe(204);
  });

  it('returns 204 when restricted admin restores an election they deleted themselves', async () => {
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

  it('returns 403 when restricted admin tries to restore election deleted by their ancestor', async () => {
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

  it('returns 204 when unrestricted admin restores election deleted by restricted admin', async () => {
    const req = await adminReq(ADMIN_RECORD); // superadmin-001
    prismaMock.election.findUnique.mockResolvedValueOnce(makeDeletedElection({}, 'admin-002'));
    mockAdminGraph();

    const res = await POST(req, PARAMS);
    expect(res.status).toBe(204);
  });

  // ── Persistence ─────────────────────────────────────────────────────────

  it('clears deleted_at and deleted_by on restore', async () => {
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

  it('invalidates the elections cache after restore', async () => {
    const { invalidateElections } = jest.requireMock('@/lib/cache');
    const req = await adminReq(ADMIN_RECORD);
    prismaMock.election.findUnique.mockResolvedValueOnce(makeDeletedElection());
    mockAdminGraph();

    await POST(req, PARAMS);

    expect(invalidateElections).toHaveBeenCalledTimes(1);
  });

  // ── Edge cases ──────────────────────────────────────────────────────────

  it('returns 204 when unrestricted admin restores election with no faculty restriction', async () => {
    const req = await adminReq(ADMIN_RECORD);
    prismaMock.election.findUnique.mockResolvedValueOnce(
      makeDeletedElection({ restrictions: [] }), // global election
    );
    mockAdminGraph();

    const res = await POST(req, PARAMS);
    expect(res.status).toBe(204);
  });
});
