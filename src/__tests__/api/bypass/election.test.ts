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
const FUTURE_VALID_UNTIL = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

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

  // ── Restriction validation ────────────────────────────────────────────────

  it('returns 400 when election has no restrictions (unrestricted election)', async () => {
    const req = await adminReq({
      bypassRestrictions: ['FACULTY'],
      validUntil: FUTURE_VALID_UNTIL,
    });
    prismaMock.election.findUnique.mockResolvedValueOnce({
      ...makeElection({ restrictions: [] }),
      restrictions: [],
    });
    mockAdminGraph();
    const { status, body } = await parseJson<any>(await POST(req, PARAMS));
    expect(status).toBe(400);
    expect(body.message).toMatch(/no restrictions/i);
  });

  it('returns 400 when bypassRestrictions is empty', async () => {
    const req = await adminReq({
      bypassRestrictions: [],
      validUntil: FUTURE_VALID_UNTIL,
    });
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
    const req = await adminReq({
      bypassRestrictions: ['GROUP'], // election only has FACULTY
      validUntil: FUTURE_VALID_UNTIL,
    });
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
    const req = await adminReq({
      bypassRestrictions: ['INVALID_TYPE'],
      validUntil: FUTURE_VALID_UNTIL,
    });
    prismaMock.election.findUnique.mockResolvedValueOnce({
      ...makeElection(),
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
    });
    mockAdminGraph();
    const { status } = await parseJson<any>(await POST(req, PARAMS));
    expect(status).toBe(400);
  });

  it('returns 400 when omitting bypassRestrictions entirely', async () => {
    const req = await adminReq({ validUntil: FUTURE_VALID_UNTIL });
    prismaMock.election.findUnique.mockResolvedValueOnce({
      ...makeElection(),
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
      maxUsage: 1,
    });
    mockAdminGraph();
    const { status } = await parseJson<any>(await POST(req, PARAMS));
    expect(status).toBe(400);
  });

  // ── maxUsage validation ────────────────────────────────────────────────────

  it('returns 400 when maxUsage is not provided', async () => {
    const req = await adminReq({
      bypassRestrictions: ['FACULTY'],
      validUntil: FUTURE_VALID_UNTIL,
    });
    prismaMock.election.findUnique.mockResolvedValueOnce({
      ...makeElection(),
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
    });
    mockAdminGraph();
    const { status, body } = await parseJson<any>(await POST(req, PARAMS));
    expect(status).toBe(400);
    expect(body.message).toMatch(new RegExp('maxUsage'));
  });

  it('returns 400 when maxUsage exceeds BYPASS_TOKEN_MAX_USAGE_MAX', async () => {
    const req = await adminReq({
      bypassRestrictions: ['FACULTY'],
      maxUsage: BYPASS_TOKEN_MAX_USAGE_MAX + 1,
      validUntil: FUTURE_VALID_UNTIL,
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

  // ── Hierarchy ─────────────────────────────────────────────────────────────

  it('returns 403 when admin is not the creator or ancestor', async () => {
    const { access } = await makeTokenPair(RESTRICTED_ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    const req = makeAuthRequest(access.token, {
      method: 'POST',
      body: { bypassRestrictions: ['FACULTY'], validUntil: FUTURE_VALID_UNTIL },
    });

    prismaMock.election.findUnique.mockResolvedValueOnce({
      ...makeElection({ created_by: 'some-other-admin' }),
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
    });
    // Admin-002 is not an ancestor of 'some-other-admin'
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
    const req = await adminReq({
      bypassRestrictions: ['FACULTY'],
      validUntil: FUTURE_VALID_UNTIL,
      maxUsage: 1,
    });
    prismaMock.election.findUnique.mockResolvedValueOnce({
      ...makeElection(),
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
    });
    mockAdminGraph();
    const { status, body } = await parseJson<any>(await POST(req, PARAMS));
    expect(status).toBe(201);
    expect(body.bypassRestrictions).toEqual(['FACULTY']);
    expect(body.currentUsage).toBe(0);
  });

  it('returns 201 when bypassing multiple restriction types all present on election', async () => {
    const req = await adminReq({
      bypassRestrictions: ['FACULTY', 'GROUP'],
      validUntil: FUTURE_VALID_UNTIL,
      maxUsage: 1,
    });
    prismaMock.election.findUnique.mockResolvedValueOnce({
      ...makeElection(),
      restrictions: [
        { type: 'FACULTY', value: 'FICE' },
        { type: 'GROUP', value: 'KV-91' },
      ],
    });
    mockAdminGraph();
    const { status } = await parseJson<any>(await POST(req, PARAMS));
    expect(status).toBe(201);
  });

  it('stores bypass_not_studying as false for election tokens', async () => {
    const req = await adminReq({
      bypassRestrictions: ['FACULTY'],
      validUntil: FUTURE_VALID_UNTIL,
      maxUsage: 1,
    });
    prismaMock.election.findUnique.mockResolvedValueOnce({
      ...makeElection(),
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
    });
    mockAdminGraph();
    await POST(req, PARAMS);
    expect(prismaMock.bypassToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bypass_not_studying: false,
          bypass_graduate: false,
          current_usage: 0,
        }),
      }),
    );
  });

  it('stores maxUsage in the database', async () => {
    const req = await adminReq({
      bypassRestrictions: ['FACULTY'],
      maxUsage: 5,
      validUntil: FUTURE_VALID_UNTIL,
    });
    prismaMock.election.findUnique.mockResolvedValueOnce({
      ...makeElection(),
      restrictions: [{ type: 'FACULTY', value: 'FICE' }],
    });
    mockAdminGraph();
    await POST(req, PARAMS);
    expect(prismaMock.bypassToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ max_usage: 5 }),
      }),
    );
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

  it('returns tokens with maxUsage and currentUsage fields', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    prismaMock.election.findUnique.mockResolvedValueOnce({
      id: MOCK_ELECTION_ID,
      created_by: 'superadmin-001',
    });
    mockAdminGraph();
    prismaMock.bypassToken.findMany.mockResolvedValueOnce([
      {
        token_hash: 'abc',
        type: 'ELECTION',
        election_id: MOCK_ELECTION_ID,
        bypass_not_studying: false,
        bypass_graduate: false,
        bypass_restrictions: ['FACULTY'],
        max_usage: 10,
        current_usage: 3,
        valid_until: new Date(Date.now() + 86400000),
        created_at: new Date(),
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
  });
});
