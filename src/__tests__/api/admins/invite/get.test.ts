import * as allure from 'allure-js-commons';

import { cacheMock, resetCacheMock } from '@/__tests__/helpers/cache-mock';
import {
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  JWT_TOKEN_RECORD,
  makeTokenPair,
  USER_PAYLOAD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/cache', () => cacheMock);

import { GET } from '@/app/api/admins/invite/route';

const FUTURE = new Date(Date.now() + 86_400_000);

function makeTokenRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    token_hash: 'hash-abc',
    max_usage: 5,
    current_usage: 0,
    manage_admins: false,
    restricted_to_faculty: true,
    valid_due: FUTURE,
    created_at: new Date(),
    creator: { user_id: 'superadmin-001', full_name: 'Super Admin User' },
    ...overrides,
  };
}

async function adminReq(adminRecord = ADMIN_RECORD) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'GET' });
}

// ===========================================================================
// GET /api/admins/invite
// ===========================================================================

describe('GET /api/admins/invite', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('Admins');
    allure.story('List Invite Tokens');
  });

  // ── Auth guards ───────────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not an admin', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    const req = makeAuthRequest(access.token, { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns 403 when admin lacks manage_admins', async () => {
    const req = await adminReq({ ...ADMIN_RECORD, manage_admins: false });
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  // ── Cache-miss path ───────────────────────────────────────────────────────

  it('returns 200 with empty array when no tokens exist', async () => {
    const req = await adminReq();
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
    ]);
    cacheMock.getCachedInviteTokens.mockResolvedValueOnce(null);
    prismaMock.adminInviteToken.findMany.mockResolvedValueOnce([]);

    const res = await GET(req);
    const { status, body } = await parseJson<unknown[]>(res);

    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it('fetches from DB on cache miss and returns visible tokens', async () => {
    const req = await adminReq();
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
    ]);
    cacheMock.getCachedInviteTokens.mockResolvedValueOnce(null);
    prismaMock.adminInviteToken.findMany.mockResolvedValueOnce([makeTokenRecord()]);

    const res = await GET(req);
    const { status, body } = await parseJson<any[]>(res);

    expect(status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].token_hash).toBe('hash-abc');
  });

  it('calls setCachedInviteTokens after a DB fetch', async () => {
    const req = await adminReq();
    prismaMock.admin.findMany.mockResolvedValueOnce([]);
    cacheMock.getCachedInviteTokens.mockResolvedValueOnce(null);
    prismaMock.adminInviteToken.findMany.mockResolvedValueOnce([makeTokenRecord()]);

    await GET(req);

    expect(cacheMock.setCachedInviteTokens).toHaveBeenCalledTimes(1);
  });

  // ── Cache-hit path ────────────────────────────────────────────────────────

  it('serves from cache without hitting adminInviteToken.findMany', async () => {
    const req = await adminReq();
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
    ]);
    cacheMock.getCachedInviteTokens.mockResolvedValueOnce([makeTokenRecord()] as any);

    const res = await GET(req);
    const { status, body } = await parseJson<any[]>(res);

    expect(status).toBe(200);
    expect(body).toHaveLength(1);
    expect(prismaMock.adminInviteToken.findMany).not.toHaveBeenCalled();
  });

  // ── isOwn / deletable flags ───────────────────────────────────────────────

  it('sets isOwn=true for tokens created by the caller', async () => {
    const req = await adminReq();
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
    ]);
    cacheMock.getCachedInviteTokens.mockResolvedValueOnce([makeTokenRecord()] as any);

    const { body } = await parseJson<any[]>(await GET(req));
    expect(body[0].isOwn).toBe(true);
    expect(body[0].deletable).toBe(true);
  });

  it('sets isOwn=false for tokens created by a subordinate admin', async () => {
    const req = await adminReq();
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
      { user_id: 'admin-002', promoted_by: 'superadmin-001' },
    ]);
    cacheMock.getCachedInviteTokens.mockResolvedValueOnce([
      makeTokenRecord({ creator: { user_id: 'admin-002', full_name: 'Test Admin' } }),
    ] as any);

    const { body } = await parseJson<any[]>(await GET(req));
    expect(body[0].isOwn).toBe(false);
    expect(body[0].deletable).toBe(true);
  });

  // ── Hierarchy visibility ──────────────────────────────────────────────────

  it('hides tokens from admins in a different hierarchy branch', async () => {
    const req = await adminReq();
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
      { user_id: 'other-root', promoted_by: null },
      { user_id: 'other-leaf', promoted_by: 'other-root' },
    ]);
    cacheMock.getCachedInviteTokens.mockResolvedValueOnce([
      makeTokenRecord({ creator: { user_id: 'other-leaf', full_name: 'Other Admin' } }),
    ] as any);

    const { body } = await parseJson<any[]>(await GET(req));
    expect(body).toHaveLength(0);
  });

  it('shows tokens from a transitive subordinate (multi-level hierarchy)', async () => {
    const req = await adminReq();
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
      { user_id: 'admin-002', promoted_by: 'superadmin-001' },
      { user_id: 'admin-003', promoted_by: 'admin-002' },
    ]);
    cacheMock.getCachedInviteTokens.mockResolvedValueOnce([
      makeTokenRecord({ creator: { user_id: 'admin-003', full_name: 'Test Admin' } }),
    ] as any);

    const { body } = await parseJson<any[]>(await GET(req));
    expect(body).toHaveLength(1);
    expect(body[0].isOwn).toBe(false);
    expect(body[0].deletable).toBe(true);
  });

  // ── Query efficiency ──────────────────────────────────────────────────────

  it('loads hierarchy graph with a single findMany (no N+1)', async () => {
    const req = await adminReq();
    prismaMock.admin.findMany.mockResolvedValueOnce([]);
    cacheMock.getCachedInviteTokens.mockResolvedValueOnce([] as any);

    await GET(req);

    expect(prismaMock.admin.findMany).toHaveBeenCalledTimes(1);
  });

  // ── Expired / exhausted cleanup (deleteMany) ───────────────────────────────

  it('deletes expired tokens with deleteMany, invalidates cache, and returns empty list', async () => {
    const req = await adminReq();

    const expired = makeTokenRecord({
      token_hash: 'expired-hash',
      valid_due: new Date(Date.now() - 60_000),
    });

    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
    ]);

    cacheMock.getCachedInviteTokens.mockResolvedValueOnce(null);
    prismaMock.adminInviteToken.findMany.mockResolvedValueOnce([expired] as any);
    prismaMock.adminInviteToken.deleteMany.mockResolvedValueOnce({ count: 1 });

    const res = await GET(req);
    const { status, body } = await parseJson<any[]>(res);

    expect(status).toBe(200);
    expect(body).toEqual([]);

    expect(prismaMock.adminInviteToken.deleteMany).toHaveBeenCalledWith({
      where: {
        token_hash: { in: ['expired-hash'] },
      },
    });

    expect(cacheMock.invalidateInviteTokens).toHaveBeenCalledTimes(1);
  });

  it('deletes exhausted tokens with deleteMany and returns empty list', async () => {
    const req = await adminReq();

    const exhausted = makeTokenRecord({
      token_hash: 'exhausted-hash',
      current_usage: 5,
      max_usage: 5,
    });

    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
    ]);

    cacheMock.getCachedInviteTokens.mockResolvedValueOnce(null);
    prismaMock.adminInviteToken.findMany.mockResolvedValueOnce([exhausted] as any);
    prismaMock.adminInviteToken.deleteMany.mockResolvedValueOnce({ count: 1 });

    const res = await GET(req);
    const { status, body } = await parseJson<any[]>(res);

    expect(status).toBe(200);
    expect(body).toEqual([]);

    expect(prismaMock.adminInviteToken.deleteMany).toHaveBeenCalledWith({
      where: {
        token_hash: { in: ['exhausted-hash'] },
      },
    });

    expect(cacheMock.invalidateInviteTokens).toHaveBeenCalledTimes(1);
  });

  it('deletes multiple stale tokens in one deleteMany call', async () => {
    const req = await adminReq();

    const expired = makeTokenRecord({
      token_hash: 'expired-hash',
      valid_due: new Date(Date.now() - 60_000),
    });

    const exhausted = makeTokenRecord({
      token_hash: 'exhausted-hash',
      current_usage: 5,
      max_usage: 5,
    });

    const valid = makeTokenRecord({
      token_hash: 'valid-hash',
    });

    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: 'superadmin-001', promoted_by: null },
    ]);

    cacheMock.getCachedInviteTokens.mockResolvedValueOnce(null);
    prismaMock.adminInviteToken.findMany.mockResolvedValueOnce([expired, exhausted, valid] as any);
    prismaMock.adminInviteToken.deleteMany.mockResolvedValueOnce({ count: 2 });

    const res = await GET(req);
    const { status, body } = await parseJson<any[]>(res);

    expect(status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].token_hash).toBe('valid-hash');

    expect(prismaMock.adminInviteToken.deleteMany).toHaveBeenCalledWith({
      where: {
        token_hash: { in: ['expired-hash', 'exhausted-hash'] },
      },
    });

    expect(cacheMock.invalidateInviteTokens).toHaveBeenCalledTimes(1);
  });
});
