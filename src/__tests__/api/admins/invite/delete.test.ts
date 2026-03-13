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

import { DELETE as DELETE_BY_HASH } from '@/app/api/admins/invite/[tokenHash]/route';

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
    created_by: 'superadmin-001',
    creator: { user_id: 'superadmin-001', full_name: 'Super Admin User' },
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

describe('DELETE /api/admins/invite/[tokenHash]', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('Admins');
    allure.story('Delete Invite Token');
  });

  // ── Auth guards ───────────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'DELETE' });
    const res = await DELETE_BY_HASH(req, params('hash-abc'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not an admin', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    const req = makeAuthRequest(access.token, { method: 'DELETE' });
    const res = await DELETE_BY_HASH(req, params('hash-abc'));
    expect(res.status).toBe(403);
  });

  it('returns 403 when admin lacks manage_admins', async () => {
    const req = await adminReq({ ...ADMIN_RECORD, manage_admins: false });
    const res = await DELETE_BY_HASH(req, params('hash-abc'));
    expect(res.status).toBe(403);
  });

  // ── Token lookup ──────────────────────────────────────────────────────────

  it('returns 404 when token does not exist', async () => {
    const req = await adminReq();
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(null);
    const res = await DELETE_BY_HASH(req, params('nonexistent-hash'));
    expect(res.status).toBe(404);
  });

  // ── Owner deletes own token (no graph query needed) ───────────────────────

  it('returns 200 when owner deletes their own token', async () => {
    const req = await adminReq();
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(
      makeTokenRecord({ created_by: 'superadmin-001' }),
    );
    prismaMock.adminInviteToken.delete.mockResolvedValueOnce({});

    const res = await DELETE_BY_HASH(req, params('hash-abc'));
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.deletedTokenHash).toBe('hash-abc');
  });

  it('skips the graph query when caller owns the token', async () => {
    const req = await adminReq();
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(
      makeTokenRecord({ created_by: 'superadmin-001' }),
    );
    prismaMock.adminInviteToken.delete.mockResolvedValueOnce({});

    await DELETE_BY_HASH(req, params('hash-abc'));

    expect(prismaMock.admin.findMany).not.toHaveBeenCalled();
  });

  // ── Ancestor deletes subordinate's token ──────────────────────────────────

  it('returns 200 when ancestor deletes a subordinate token', async () => {
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
    expect(res.status).toBe(200);
  });

  it('loads the hierarchy graph with a single findMany (no N+1)', async () => {
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

  // ── Non-ancestor forbidden ────────────────────────────────────────────────

  it('returns 403 when caller is not ancestor of token creator', async () => {
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

  it('invalidates invite token cache after deletion', async () => {
    const req = await adminReq();
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(
      makeTokenRecord({ created_by: 'superadmin-001' }),
    );
    prismaMock.adminInviteToken.delete.mockResolvedValueOnce({});

    await DELETE_BY_HASH(req, params('hash-abc'));

    expect(cacheMock.invalidateInviteTokens).toHaveBeenCalledTimes(1);
  });
});
