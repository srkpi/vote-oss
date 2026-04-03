import * as allure from 'allure-js-commons';

import { cacheMock, resetCacheMock } from '@/__tests__/helpers/cache-mock';
import {
  ADMIN_API,
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  JWT_TOKEN_RECORD,
  makeElection,
  makeTokenPair,
  MOCK_ELECTION_ID,
  RESTRICTED_ADMIN_API,
  RESTRICTED_ADMIN_PAYLOAD,
  RESTRICTED_ADMIN_RECORD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';
import { BYPASS_TOKEN_MAX_USAGE_MAX } from '@/lib/constants';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/cache', () => cacheMock);

import { GET, POST } from '@/app/api/elections/[id]/bypass/route';

const PARAMS = { params: Promise.resolve({ id: MOCK_ELECTION_ID }) };

async function adminReq(body: object = {}) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
  return makeAuthRequest(access.token, { method: 'POST', body });
}

function mockAdminGraph() {
  cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);
}

describe('POST /api/elections/[id]/bypass', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('Bypass');
    allure.story('Create Election Bypass Token');
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'POST', body: {} });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(401);
  });

  it('returns 400 for non-uuid election id', async () => {
    const req = await adminReq({});
    const res = await POST(req, { params: Promise.resolve({ id: 'bad-id' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when election does not exist', async () => {
    const req = await adminReq({});
    prismaMock.election.findUnique.mockResolvedValueOnce(null);
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(404);
  });

  it('returns 400 when election has no restrictions', async () => {
    const req = await adminReq({ bypassRestrictions: ['FACULTY'], maxUsage: 1 });
    prismaMock.election.findUnique.mockResolvedValueOnce({
      ...makeElection({ restrictions: [] }),
      restrictions: [],
    });
    mockAdminGraph();
    const { status, body } = await parseJson<any>(await POST(req, PARAMS));
    expect(status).toBe(400);
    expect(body.message).toMatch(/no restrictions/i);
  });

  // ── No validUntil — token validity tied to election closes_at ─────────────

  it('does NOT accept a validUntil field (ignored / not required)', async () => {
    const req = await adminReq({
      bypassRestrictions: ['FACULTY'],
      maxUsage: 1,
      validUntil: new Date(Date.now() + 3_600_000).toISOString(),
    });
    prismaMock.election.findUnique.mockResolvedValueOnce({
      ...makeElection(),
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
    });
    mockAdminGraph();
    const { status } = await parseJson<any>(await POST(req, PARAMS));
    expect(status).toBe(201);
  });

  // ── Restriction validation ────────────────────────────────────────────────

  it('returns 400 when bypassRestrictions is empty', async () => {
    const req = await adminReq({ bypassRestrictions: [], maxUsage: 1 });
    prismaMock.election.findUnique.mockResolvedValueOnce({
      ...makeElection(),
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
    });
    mockAdminGraph();
    const { status, body } = await parseJson<any>(await POST(req, PARAMS));
    expect(status).toBe(400);
    expect(body.message).toMatch(/at least one/i);
  });

  it('returns 400 when bypassRestrictions contains a type not on the election', async () => {
    const req = await adminReq({ bypassRestrictions: ['GROUP'], maxUsage: 1 });
    prismaMock.election.findUnique.mockResolvedValueOnce({
      ...makeElection(),
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
    });
    mockAdminGraph();
    const { status, body } = await parseJson<any>(await POST(req, PARAMS));
    expect(status).toBe(400);
    expect(body.message).toMatch(/GROUP/);
  });

  it('returns 400 when bypassRestrictions contains an unknown type', async () => {
    const req = await adminReq({ bypassRestrictions: ['INVALID_TYPE'], maxUsage: 1 });
    prismaMock.election.findUnique.mockResolvedValueOnce({
      ...makeElection(),
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
    });
    mockAdminGraph();
    const { status } = await parseJson<any>(await POST(req, PARAMS));
    expect(status).toBe(400);
  });

  it('returns 400 when omitting bypassRestrictions entirely', async () => {
    const req = await adminReq({ maxUsage: 1 });
    prismaMock.election.findUnique.mockResolvedValueOnce({
      ...makeElection(),
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
    });
    mockAdminGraph();
    const { status } = await parseJson<any>(await POST(req, PARAMS));
    expect(status).toBe(400);
  });

  // ── maxUsage validation ────────────────────────────────────────────────────

  it('returns 400 when maxUsage is not provided', async () => {
    const req = await adminReq({ bypassRestrictions: ['FACULTY'] });
    prismaMock.election.findUnique.mockResolvedValueOnce({
      ...makeElection(),
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
    });
    mockAdminGraph();
    const { status, body } = await parseJson<any>(await POST(req, PARAMS));
    expect(status).toBe(400);
    expect(body.message).toMatch(/maxUsage/);
  });

  it('returns 400 when maxUsage exceeds BYPASS_TOKEN_MAX_USAGE_MAX', async () => {
    const req = await adminReq({
      bypassRestrictions: ['FACULTY'],
      maxUsage: BYPASS_TOKEN_MAX_USAGE_MAX + 1,
    });
    prismaMock.election.findUnique.mockResolvedValueOnce({
      ...makeElection(),
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
    });
    mockAdminGraph();
    const { status, body } = await parseJson<any>(await POST(req, PARAMS));
    expect(status).toBe(400);
    expect(body.message).toMatch(new RegExp(String(BYPASS_TOKEN_MAX_USAGE_MAX)));
  });

  it('returns 400 when maxUsage is zero', async () => {
    const req = await adminReq({ bypassRestrictions: ['FACULTY'], maxUsage: 0 });
    prismaMock.election.findUnique.mockResolvedValueOnce({
      ...makeElection(),
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
    });
    mockAdminGraph();
    const { status } = await parseJson<any>(await POST(req, PARAMS));
    expect(status).toBe(400);
  });

  // ── Token limit counts only active (non-deleted) tokens ───────────────────

  it('counts only non-deleted tokens toward the per-election limit', async () => {
    const req = await adminReq({ bypassRestrictions: ['FACULTY'], maxUsage: 1 });
    prismaMock.election.findUnique.mockResolvedValueOnce({
      ...makeElection(),
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
    });
    mockAdminGraph();
    // count returns 0 = only non-deleted tokens counted
    prismaMock.electionBypassToken.count.mockResolvedValueOnce(0);

    const { status } = await parseJson<any>(await POST(req, PARAMS));
    expect(status).toBe(201);

    // Verify the count query filters for deleted_at: null
    expect(prismaMock.electionBypassToken.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deleted_at: null }),
      }),
    );
  });

  // ── Hierarchy ─────────────────────────────────────────────────────────────

  it('returns 403 when admin is not the creator or ancestor', async () => {
    const { access } = await makeTokenPair(RESTRICTED_ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    const req = makeAuthRequest(access.token, {
      method: 'POST',
      body: { bypassRestrictions: ['FACULTY'], maxUsage: 1 },
    });

    prismaMock.election.findUnique.mockResolvedValueOnce({
      ...makeElection({ created_by: 'some-other-admin' }),
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
    });
    cacheMock.getCachedAdmins.mockResolvedValueOnce([
      ADMIN_API,
      RESTRICTED_ADMIN_API,
      { ...RESTRICTED_ADMIN_API, userId: 'some-other-admin', promoter: null },
    ] as any);

    const res = await POST(req, PARAMS);
    expect(res.status).toBe(403);
  });

  // ── Successful creation ────────────────────────────────────────────────────

  it('returns 201 with valid FACULTY bypass for election with FACULTY restriction', async () => {
    const req = await adminReq({ bypassRestrictions: ['FACULTY'], maxUsage: 1 });
    prismaMock.election.findUnique.mockResolvedValueOnce({
      ...makeElection(),
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
    });
    mockAdminGraph();
    const { status, body } = await parseJson<any>(await POST(req, PARAMS));
    expect(status).toBe(201);
    expect(body.bypassRestrictions).toEqual(['FACULTY']);
    expect(body.currentUsage).toBe(0);
    expect(body.maxUsage).toBe(1);
    expect(body.deletedAt).toBeNull();
    expect(body.validUntil).toBeUndefined();
    expect(body.canDelete).toBe(true);
    expect(body.canRevokeUsages).toBe(true);
  });

  it('stores maxUsage in the database', async () => {
    const req = await adminReq({ bypassRestrictions: ['FACULTY'], maxUsage: 5 });
    prismaMock.election.findUnique.mockResolvedValueOnce({
      ...makeElection(),
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
    });
    mockAdminGraph();
    await POST(req, PARAMS);
    expect(prismaMock.electionBypassToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ max_usage: 5, current_usage: 0 }),
      }),
    );
  });

  it('stores correct fields in database (no valid_until, no deleted_at)', async () => {
    const req = await adminReq({ bypassRestrictions: ['FACULTY'], maxUsage: 1 });
    prismaMock.election.findUnique.mockResolvedValueOnce({
      ...makeElection(),
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
    });
    mockAdminGraph();
    await POST(req, PARAMS);
    const createCall = prismaMock.electionBypassToken.create.mock.calls[0][0];
    expect(createCall.data).not.toHaveProperty('valid_until');
    expect(createCall.data).not.toHaveProperty('deleted_at');
    expect(createCall.data).toMatchObject({
      election_id: MOCK_ELECTION_ID,
      bypass_restrictions: ['FACULTY'],
      max_usage: 1,
      current_usage: 0,
    });
  });
});

describe('GET /api/elections/[id]/bypass', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('Bypass');
    allure.story('List Election Bypass Tokens');
  });

  it('returns tokens with deletedAt field and canDelete/canRevokeUsages', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    prismaMock.election.findUnique.mockResolvedValueOnce({
      id: MOCK_ELECTION_ID,
      created_by: 'superadmin-001',
    });
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);
    prismaMock.electionBypassToken.findMany.mockResolvedValueOnce([
      {
        token_hash: 'abc',
        election_id: MOCK_ELECTION_ID,
        bypass_restrictions: ['FACULTY'],
        max_usage: 10,
        current_usage: 3,
        created_at: new Date(),
        deleted_at: null,
        created_by: 'superadmin-001',
        creator: { user_id: 'superadmin-001', full_name: 'Super Admin' },
        usages: [],
      },
    ]);

    const req = makeAuthRequest(access.token, { method: 'GET' });
    const { status, body } = await parseJson<any[]>(await GET(req, PARAMS));

    expect(status).toBe(200);
    expect(body[0].maxUsage).toBe(10);
    expect(body[0].currentUsage).toBe(3);
    expect(body[0].bypassRestrictions).toEqual(['FACULTY']);
    expect(body[0].deletedAt).toBeNull();
    expect(body[0].canDelete).toBe(true);
    expect(body[0].canRevokeUsages).toBe(true);
  });

  it('includes soft-deleted tokens in the listing (for audit trail)', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    prismaMock.election.findUnique.mockResolvedValueOnce({
      id: MOCK_ELECTION_ID,
      created_by: 'superadmin-001',
    });
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);

    const deletedAt = new Date('2024-06-01T12:00:00Z');
    prismaMock.electionBypassToken.findMany.mockResolvedValueOnce([
      {
        token_hash: 'deleted-token',
        election_id: MOCK_ELECTION_ID,
        bypass_restrictions: ['FACULTY'],
        max_usage: 5,
        current_usage: 2,
        created_at: new Date(),
        deleted_at: deletedAt,
        created_by: 'superadmin-001',
        creator: { user_id: 'superadmin-001', full_name: 'Super Admin' },
        usages: [
          {
            id: 'usage-1',
            user_id: 'user-001',
            used_at: new Date(),
            revoked_at: null,
          },
        ],
      },
    ]);

    const req = makeAuthRequest(access.token, { method: 'GET' });
    const { status, body } = await parseJson<any[]>(await GET(req, PARAMS));

    expect(status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].deletedAt).toBe(deletedAt.toISOString());
    // Soft-deleted tokens cannot be deleted again
    expect(body[0].canDelete).toBe(false);
    // Usages are still present for audit
    expect(body[0].usages).toHaveLength(1);
  });

  it('returns all tokens (active + deleted) without filtering', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    prismaMock.election.findUnique.mockResolvedValueOnce({
      id: MOCK_ELECTION_ID,
      created_by: 'superadmin-001',
    });
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);
    prismaMock.electionBypassToken.findMany.mockResolvedValueOnce([
      {
        token_hash: 'active-token',
        election_id: MOCK_ELECTION_ID,
        bypass_restrictions: ['FACULTY'],
        max_usage: 5,
        current_usage: 0,
        created_at: new Date(),
        deleted_at: null,
        created_by: 'superadmin-001',
        creator: { user_id: 'superadmin-001', full_name: 'Super Admin' },
        usages: [],
      },
      {
        token_hash: 'deleted-token',
        election_id: MOCK_ELECTION_ID,
        bypass_restrictions: ['FACULTY'],
        max_usage: 5,
        current_usage: 1,
        created_at: new Date(),
        deleted_at: new Date(),
        created_by: 'superadmin-001',
        creator: { user_id: 'superadmin-001', full_name: 'Super Admin' },
        usages: [],
      },
    ]);

    const req = makeAuthRequest(access.token, { method: 'GET' });
    const { status, body } = await parseJson<any[]>(await GET(req, PARAMS));

    expect(status).toBe(200);
    expect(body).toHaveLength(2); // both active and deleted are returned
  });

  it('sets canDelete=false and canRevokeUsages=false for restricted admin on other creator token', async () => {
    const { access } = await makeTokenPair(RESTRICTED_ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    prismaMock.election.findUnique.mockResolvedValueOnce({
      id: MOCK_ELECTION_ID,
      created_by: 'admin-002',
    });
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_API, RESTRICTED_ADMIN_API] as any);
    prismaMock.electionBypassToken.findMany.mockResolvedValueOnce([
      {
        token_hash: 'abc',
        election_id: MOCK_ELECTION_ID,
        bypass_restrictions: ['FACULTY'],
        max_usage: 1,
        current_usage: 0,
        created_at: new Date(),
        deleted_at: null,
        created_by: 'superadmin-001',
        creator: { user_id: 'superadmin-001', full_name: 'Super Admin' },
        usages: [],
      },
    ]);

    const req = makeAuthRequest(access.token, { method: 'GET' });
    const { status, body } = await parseJson<any[]>(await GET(req, PARAMS));
    expect(status).toBe(200);
    expect(body[0].canDelete).toBe(false);
    expect(body[0].canRevokeUsages).toBe(false);
  });
});
