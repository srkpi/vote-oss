import * as allure from 'allure-js-commons';

import { generateInviteToken, hashToken } from '@/lib/crypto';

import {
  ADMIN_RECORD,
  JWT_TOKEN_RECORD,
  makeTokenPair,
  USER_PAYLOAD,
} from '../../helpers/fixtures';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '../../helpers/request';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { POST } from '@/app/api/admins/join/route';

function makeInviteRecord(
  overrides: Partial<{
    valid_due: Date;
    current_usage: number;
    max_usage: number;
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
    allure.feature('Admins');
    allure.story('Redeem Invite Token');
  });

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

  it('returns 409 when user is already an admin', async () => {
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(makeInviteRecord());
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    const req = makeAuthRequest(access.token, { method: 'POST', body: { token: 'sometoken' } });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it('returns 201 with admin info on successful join', async () => {
    const rawToken = generateInviteToken();
    const { access } = await makeTokenPair(USER_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(makeInviteRecord());
    prismaMock.admin.findUnique.mockResolvedValueOnce(null);
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

  it('creates admin record and increments usage atomically via $transaction', async () => {
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
});
