import * as allure from 'allure-js-commons';

import { generateInviteToken, hashToken } from '@/lib/crypto';

import { cacheMock, resetCacheMock } from '../../helpers/cache-mock';
import {
  ADMIN_RECORD,
  DELETED_ADMIN_RECORD,
  JWT_TOKEN_RECORD,
  makeTokenPair,
  USER_PAYLOAD,
} from '../../helpers/fixtures';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '../../helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '../../helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);
jest.mock('@/lib/cache', () => cacheMock);

import { POST } from '@/app/api/admins/join/route';

function makeInviteRecord(
  overrides: Partial<{
    valid_due: Date;
    current_usage: number;
    max_usage: number;
    created_by: string;
    manage_admins: boolean;
    restricted_to_faculty: boolean;
  }> = {},
) {
  return {
    token_hash: 'hash',
    max_usage: 5,
    current_usage: 0,
    manage_admins: false,
    restricted_to_faculty: true,
    valid_due: new Date(Date.now() + 86_400_000),
    created_at: new Date(),
    created_by: 'superadmin-001',
    creator: ADMIN_RECORD,
    ...overrides,
  };
}

describe('POST /api/admins/join', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    resetCacheMock();
    allure.feature('Admins');
    allure.story('Redeem Invite Token');
  });

  // ── Auth guards ───────────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest({ method: 'POST', body: { token: 'abc' } });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when token is missing from body', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    const req = makeAuthRequest(access.token, { method: 'POST', body: {} });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // ── Invite-token validation ───────────────────────────────────────────────

  it('returns 404 when invite token is unknown (wrong hash)', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(null);
    const req = makeAuthRequest(access.token, { method: 'POST', body: { token: 'nonexistent' } });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 400 when invite token is expired', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(
      makeInviteRecord({ valid_due: new Date(Date.now() - 1000) }),
    );
    const req = makeAuthRequest(access.token, { method: 'POST', body: { token: 'expired' } });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when invite token max_usage is exhausted', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(
      makeInviteRecord({ current_usage: 5, max_usage: 5 }),
    );
    const req = makeAuthRequest(access.token, { method: 'POST', body: { token: 'used-up' } });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // ── Active-admin conflict ─────────────────────────────────────────────────

  it('returns 409 when user is already an active admin', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(makeInviteRecord());
    // Existing active admin record (deleted_at = null)
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    const req = makeAuthRequest(access.token, { method: 'POST', body: { token: 'sometoken' } });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  // ── Brand-new admin (happy path) ─────────────────────────────────────────

  it('returns 201 with admin info on successful first-time join', async () => {
    const rawToken = generateInviteToken();
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(makeInviteRecord());
    prismaMock.admin.findUnique.mockResolvedValueOnce(null); // no existing record
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    const req = makeAuthRequest(access.token, { method: 'POST', body: { token: rawToken } });
    const res = await POST(req);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(201);
    expect(body.userId).toBe(USER_PAYLOAD.sub);
    expect(body.faculty).toBe(USER_PAYLOAD.faculty);
    expect(body.promotedBy).toBe('superadmin-001');
  });

  it('looks up invite token using SHA-256 hash of provided raw token', async () => {
    const rawToken = generateInviteToken();
    const expectedHash = hashToken(rawToken);

    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(null);

    const req = makeAuthRequest(access.token, { method: 'POST', body: { token: rawToken } });
    await POST(req);

    expect(prismaMock.adminInviteToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { token_hash: expectedHash } }),
    );
  });

  it('creates admin record and increments usage atomically via $transaction for new admin', async () => {
    const rawToken = generateInviteToken();
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(makeInviteRecord());
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    const req = makeAuthRequest(access.token, { method: 'POST', body: { token: rawToken } });
    await POST(req);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    const [ops] = prismaMock.$transaction.mock.calls[0];
    expect(ops).toHaveLength(2);
  });

  // ── Re-join (previously soft-deleted admin) ───────────────────────────────

  it('returns 201 when a previously-deleted admin rejoins with a valid invite', async () => {
    const rawToken = generateInviteToken();
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(makeInviteRecord());
    // Existing soft-deleted record
    prismaMock.admin.findUnique.mockResolvedValueOnce(DELETED_ADMIN_RECORD);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    const req = makeAuthRequest(access.token, { method: 'POST', body: { token: rawToken } });
    const res = await POST(req);
    const { status, body } = await parseJson<any>(res);

    expect(status).toBe(201);
    expect(body.userId).toBe(USER_PAYLOAD.sub);
  });

  it('uses admin.update (not admin.create) when a soft-deleted admin rejoins', async () => {
    const rawToken = generateInviteToken();
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(makeInviteRecord());
    prismaMock.admin.findUnique.mockResolvedValueOnce(DELETED_ADMIN_RECORD);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    const req = makeAuthRequest(access.token, { method: 'POST', body: { token: rawToken } });
    await POST(req);

    // The first operation in the transaction should be an update, not a create.
    // We distinguish by checking the mock call order on the delegates.
    expect(prismaMock.admin.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.admin.create).not.toHaveBeenCalled();
  });

  it('nullifies deleted_at and deleted_by when a soft-deleted admin rejoins', async () => {
    const rawToken = generateInviteToken();
    const newInviter = 'another-admin-999';
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(
      makeInviteRecord({ created_by: newInviter }),
    );
    prismaMock.admin.findUnique.mockResolvedValueOnce(DELETED_ADMIN_RECORD);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    const req = makeAuthRequest(access.token, { method: 'POST', body: { token: rawToken } });
    await POST(req);

    expect(prismaMock.admin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: USER_PAYLOAD.sub },
        data: expect.objectContaining({
          deleted_at: null,
          deleted_by: null,
        }),
      }),
    );
  });

  it('sets new promoted_by from the invite token when a soft-deleted admin rejoins', async () => {
    const rawToken = generateInviteToken();
    const newInviter = 'another-admin-999';
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(
      makeInviteRecord({ created_by: newInviter }),
    );
    prismaMock.admin.findUnique.mockResolvedValueOnce(DELETED_ADMIN_RECORD);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    const req = makeAuthRequest(access.token, { method: 'POST', body: { token: rawToken } });
    await POST(req);

    expect(prismaMock.admin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ promoted_by: newInviter }),
      }),
    );
  });

  it('applies new manage_admins and restricted_to_faculty from the invite on rejoin', async () => {
    const rawToken = generateInviteToken();
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(
      makeInviteRecord({ manage_admins: true, restricted_to_faculty: false }),
    );
    prismaMock.admin.findUnique.mockResolvedValueOnce(DELETED_ADMIN_RECORD);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    const req = makeAuthRequest(access.token, { method: 'POST', body: { token: rawToken } });
    await POST(req);

    expect(prismaMock.admin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          manage_admins: true,
          restricted_to_faculty: false,
        }),
      }),
    );
  });

  it('increments invite-token usage atomically on rejoin (2-op transaction)', async () => {
    const rawToken = generateInviteToken();
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(makeInviteRecord());
    prismaMock.admin.findUnique.mockResolvedValueOnce(DELETED_ADMIN_RECORD);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    const req = makeAuthRequest(access.token, { method: 'POST', body: { token: rawToken } });
    await POST(req);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    const [ops] = prismaMock.$transaction.mock.calls[0];
    expect(ops).toHaveLength(2);
  });

  it('returns the correct promotedBy (new inviter) in the response on rejoin', async () => {
    const rawToken = generateInviteToken();
    const newInviter = 'fresh-inviter-007';
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(
      makeInviteRecord({ created_by: newInviter }),
    );
    prismaMock.admin.findUnique.mockResolvedValueOnce(DELETED_ADMIN_RECORD);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    const req = makeAuthRequest(access.token, { method: 'POST', body: { token: rawToken } });
    const res = await POST(req);
    const { body } = await parseJson<any>(res);

    expect(body.promotedBy).toBe(newInviter);
  });

  it('invalidates the admins cache on a successful rejoin', async () => {
    const rawToken = generateInviteToken();
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(makeInviteRecord());
    prismaMock.admin.findUnique.mockResolvedValueOnce(DELETED_ADMIN_RECORD);
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    const req = makeAuthRequest(access.token, { method: 'POST', body: { token: rawToken } });
    await POST(req);

    expect(cacheMock.invalidateAdmins).toHaveBeenCalledTimes(1);
  });
});
