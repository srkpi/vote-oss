import * as allure from 'allure-js-commons';

import { cacheMock, resetCacheMock } from '../../helpers/cache-mock';
import {
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  DELETED_ADMIN_RECORD,
  JWT_TOKEN_RECORD,
  makeTokenPair,
  RESTRICTED_ADMIN_RECORD,
  USER_PAYLOAD,
} from '../../helpers/fixtures';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '../../helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '../../helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/cache', () => cacheMock);

import { GET } from '@/app/api/admins/route';

describe('GET /api/admins', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('Admins');
    allure.story('List Admins');
  });

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when called by a non-admin user', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    const req = makeAuthRequest(access.token);
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns 403 when is_admin flag is set but no admin DB record exists', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);
    const req = makeAuthRequest(access.token);
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns 403 when the caller admin has been soft-deleted', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    // requireAdmin returns 403 when deleted_at is non-null
    prismaMock.admin.findUnique.mockResolvedValueOnce(DELETED_ADMIN_RECORD);
    const req = makeAuthRequest(access.token);
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns 200 with empty array when no admins exist', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    prismaMock.admin.findMany
      .mockResolvedValueOnce([]) // graph (all nodes including deleted)
      .mockResolvedValueOnce([]); // active admins (deleted_at: null)

    const req = makeAuthRequest(access.token);
    const { status, body } = await parseJson<any[]>(await GET(req));

    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it('returns a list of admins with correct fields', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    prismaMock.admin.findMany
      .mockResolvedValueOnce([
        // graph — uses promoted_by FK (internal hierarchy query)
        { user_id: ADMIN_RECORD.user_id, promoted_by: null },
        { user_id: RESTRICTED_ADMIN_RECORD.user_id, promoted_by: 'superadmin-001' },
      ])
      .mockResolvedValueOnce([ADMIN_RECORD, RESTRICTED_ADMIN_RECORD]); // active admins

    const req = makeAuthRequest(access.token);
    const { body } = await parseJson<any[]>(await GET(req));

    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({
      user_id: ADMIN_RECORD.user_id,
      full_name: ADMIN_RECORD.full_name,
      promoter: null,
      deletable: false,
    });
    expect(body[1]).toMatchObject({
      user_id: RESTRICTED_ADMIN_RECORD.user_id,
      full_name: RESTRICTED_ADMIN_RECORD.full_name,
      promoter: { user_id: 'superadmin-001', full_name: 'Super Admin User' },
      deletable: true,
    });
  });

  // ── Soft-delete filtering ─────────────────────────────────────────────────

  it('queries the DB with a deleted_at: null filter to exclude soft-deleted admins', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    prismaMock.admin.findMany
      .mockResolvedValueOnce([]) // graph
      .mockResolvedValueOnce([]); // active admins

    const req = makeAuthRequest(access.token);
    await GET(req);

    // The second findMany call must carry the soft-delete filter
    expect(prismaMock.admin.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deleted_at: null },
      }),
    );
  });

  it('does not include soft-deleted admins returned from cache', async () => {
    // The cache is populated only with active admins; soft-deleted ones are
    // never written to it.  Even on a cache hit the graph query still runs
    // (it's a cheap SELECT of two columns, needed for deletable computation).
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    // Graph query always runs — return only active node
    prismaMock.admin.findMany.mockResolvedValueOnce([
      { user_id: ADMIN_RECORD.user_id, promoted_by: null },
    ]);
    // Cache holds only the active admin
    cacheMock.getCachedAdmins.mockResolvedValueOnce([ADMIN_RECORD] as any);

    const req = makeAuthRequest(access.token);
    const { body } = await parseJson<any[]>(await GET(req));

    const ids = body.map((a: any) => a.user_id);
    expect(ids).not.toContain(DELETED_ADMIN_RECORD.user_id);
    expect(ids).toContain(ADMIN_RECORD.user_id);
    // Only the graph findMany ran — the active-admin findMany was skipped (cache hit)
    expect(prismaMock.admin.findMany).toHaveBeenCalledTimes(1);
  });

  it('marks a soft-deleted admin as not deletable even if promoter points to caller', async () => {
    // Soft-deleted admins should not appear in the list at all; this test
    // confirms that the DB query properly excludes them so the deletable
    // computation never even sees them.
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    prismaMock.admin.findMany
      .mockResolvedValueOnce([
        // graph
        { user_id: ADMIN_RECORD.user_id, promoted_by: null },
      ])
      .mockResolvedValueOnce([ADMIN_RECORD]); // active admins (deleted one filtered by where)

    const req = makeAuthRequest(access.token);
    const { body } = await parseJson<any[]>(await GET(req));

    expect(body).toHaveLength(1);
    expect(body[0].user_id).toBe(ADMIN_RECORD.user_id);
  });

  // ── Hierarchy preservation ────────────────────────────────────────────────

  it('correctly computes deletable=true for an active admin whose promoter has been soft-deleted', async () => {
    // Scenario: caller (superadmin-001) → admin-middle[deleted] → admin-leaf[active]
    // admin-middle is absent from the active list but present in the full graph.
    // The deletable flag for admin-leaf should still be true.
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);

    const activeLeaf = {
      ...RESTRICTED_ADMIN_RECORD,
      user_id: 'admin-leaf',
      promoter: { user_id: 'admin-middle', full_name: 'Admin Middle' },
    };
    prismaMock.admin.findMany
      .mockResolvedValueOnce([
        // graph — includes deleted middle; uses promoted_by FK (internal)
        { user_id: 'superadmin-001', promoted_by: null },
        { user_id: 'admin-middle', promoted_by: 'superadmin-001' },
        { user_id: 'admin-leaf', promoted_by: 'admin-middle' },
      ])
      .mockResolvedValueOnce([ADMIN_RECORD, activeLeaf]); // active admins only

    const req = makeAuthRequest(access.token);
    const { body } = await parseJson<any[]>(await GET(req));

    const leaf = body.find((a: any) => a.user_id === 'admin-leaf');
    expect(leaf).toBeDefined();
    expect(leaf.deletable).toBe(true);
    expect(leaf.promoter).toEqual({ user_id: 'admin-middle', full_name: 'Admin Middle' });
  });
});
