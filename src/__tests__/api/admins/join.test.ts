import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { cacheMock, resetCacheMock } from '@/__tests__/helpers/cache-mock';
import {
  ADMIN_RECORD,
  DELETED_ADMIN_RECORD,
  JWT_TOKEN_RECORD,
  makeTokenPair,
  USER_PAYLOAD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRequest } from '@/__tests__/helpers/request';
import { TEST_NOW } from '@/__tests__/helpers/time';
import { resetTokenStoreMock } from '@/__tests__/helpers/token-store-mock';
import { generateBase64Token, hashToken } from '@/lib/crypto';

vi.mock('@/lib/prisma', async () => {
  const { prismaMock } = await import('@/__tests__/helpers/prisma-mock');
  return { prisma: prismaMock };
});
vi.mock('@/lib/token-store', async () => {
  const { tokenStoreMock } = await import('@/__tests__/helpers/token-store-mock');
  return tokenStoreMock;
});
vi.mock('@/lib/cache', async () => {
  const { cacheMock } = await import('@/__tests__/helpers/cache-mock');
  return cacheMock;
});

import { POST } from '@/app/api/admins/join/route';
import { INVITE_TOKEN_LENGTH } from '@/lib/constants';

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

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetPrismaMock();
  resetTokenStoreMock();
  resetCacheMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Accepting an admin invitation (POST /api/admins/join)', () => {
  beforeEach(() => {
    allure.feature('Admins');
    allure.story('Redeem Invite Token');
  });

  // ── Auth guards ───────────────────────────────────────────────────────────

  describe('when checking caller access', () => {
    it('should return 401 when no user is signed in', async () => {
      const req = makeRequest({ method: 'POST', body: { token: 'abc' } });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('should return 400 when token is missing from body', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
      const req = makeAuthRequest(access.token, { method: 'POST', body: {} });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  // ── Invite-token validation ───────────────────────────────────────────────

  describe('when validating the invitation', () => {
    it('should return 404 when invite token is unknown (wrong hash)', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
      prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(null);
      const req = makeAuthRequest(access.token, { method: 'POST', body: { token: 'nonexistent' } });
      const res = await POST(req);
      expect(res.status).toBe(404);
    });

    it('should return 400 when invite token is expired', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
      prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(
        makeInviteRecord({ valid_due: new Date(Date.now() - 1000) }),
      );
      const req = makeAuthRequest(access.token, { method: 'POST', body: { token: 'expired' } });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should return 400 when invite token max_usage is exhausted', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
      prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(
        makeInviteRecord({ current_usage: 5, max_usage: 5 }),
      );
      const req = makeAuthRequest(access.token, { method: 'POST', body: { token: 'used-up' } });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  // ── Active-admin conflict ─────────────────────────────────────────────────

  it('should return 409 when user is already an active admin', async () => {
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

  describe('when a user first joins the admin team', () => {
    it('should grant admin access and return 201 when a user accepts their first valid invitation', async () => {
      const rawToken = generateBase64Token(INVITE_TOKEN_LENGTH);
      const { access } = await makeTokenPair(USER_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
      prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(makeInviteRecord());
      prismaMock.admin.findUnique.mockResolvedValueOnce(null); // no existing record
      prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

      const req = makeAuthRequest(access.token, { method: 'POST', body: { token: rawToken } });
      const res = await POST(req);
      expect(res.status).toBe(201);
    });

    it('should look up invite token using SHA-256 hash of provided raw token when accepting an admin invitation', async () => {
      const rawToken = generateBase64Token(INVITE_TOKEN_LENGTH);
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

    it('should grant admin access and consume one invitation use together when a new admin joins', async () => {
      const rawToken = generateBase64Token(INVITE_TOKEN_LENGTH);
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

  // ── Re-join (previously soft-deleted admin) ───────────────────────────────

  describe('when a former admin rejoins the team', () => {
    it('should return 201 when a previously-deleted admin rejoins with a valid invite', async () => {
      const rawToken = generateBase64Token(INVITE_TOKEN_LENGTH);
      const { access } = await makeTokenPair(USER_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
      prismaMock.adminInviteToken.findUnique.mockResolvedValueOnce(makeInviteRecord());
      // Existing soft-deleted record
      prismaMock.admin.findUnique.mockResolvedValueOnce(DELETED_ADMIN_RECORD);
      prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

      const req = makeAuthRequest(access.token, { method: 'POST', body: { token: rawToken } });
      const res = await POST(req);
      expect(res.status).toBe(201);
    });

    it('should reactivate the existing admin record when a former admin accepts an invitation', async () => {
      const rawToken = generateBase64Token(INVITE_TOKEN_LENGTH);
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

    it('should clear the deletion time and actor when a former admin rejoins', async () => {
      const rawToken = generateBase64Token(INVITE_TOKEN_LENGTH);
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

    it('should replace the promoter with the invitation creator when a former admin rejoins', async () => {
      const rawToken = generateBase64Token(INVITE_TOKEN_LENGTH);
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

    it('should replace previous permissions with invitation permissions when a former admin rejoins', async () => {
      const rawToken = generateBase64Token(INVITE_TOKEN_LENGTH);
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

    it('should consume one invitation use together with reactivation when a former admin rejoins', async () => {
      const rawToken = generateBase64Token(INVITE_TOKEN_LENGTH);
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

    it('should invalidate the admins cache on a successful rejoin when accepting an admin invitation', async () => {
      const rawToken = generateBase64Token(INVITE_TOKEN_LENGTH);
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
});
