import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { cacheMock, resetCacheMock } from '@/__tests__/helpers/cache-mock';
import {
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  JWT_TOKEN_RECORD,
  makeTokenPair,
  RESTRICTED_ADMIN_RECORD,
  USER_PAYLOAD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '@/__tests__/helpers/request';
import { TEST_NOW } from '@/__tests__/helpers/time';
import { resetTokenStoreMock } from '@/__tests__/helpers/token-store-mock';
import {
  INVITE_TOKEN_LENGTH,
  INVITE_TOKEN_MAX_COUNT,
  INVITE_TOKEN_MAX_VALID_DAYS,
} from '@/lib/constants';

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

import { POST } from '@/app/api/admins/invite/route';

const FUTURE = new Date(TEST_NOW + 86_400_000).toISOString();

async function adminReq(body: object, adminRecord: object = ADMIN_RECORD) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(adminRecord);
  return makeAuthRequest(access.token, { method: 'POST', body });
}

// ===========================================================================
// POST /api/admins/invite
// ===========================================================================

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetPrismaMock();
  resetTokenStoreMock();
  resetCacheMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Creating an admin invitation (POST /api/admins/invite)', () => {
  beforeEach(() => {
    allure.feature('Admins');
    allure.story('Create Invite Token');
  });

  // ── Auth guards ───────────────────────────────────────────────────────────

  describe('when checking caller access', () => {
    it('should return 401 when no user is signed in', async () => {
      const req = makeRequest({ method: 'POST' });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('should return 403 when the signed-in user is not an admin', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
      const req = makeAuthRequest(access.token, { method: 'POST', body: {} });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it('should return 403 when the admin cannot manage other admins', async () => {
      const req = await adminReq({ validDue: FUTURE }, { ...ADMIN_RECORD, manage_admins: false });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });
  });

  // ── Input validation ──────────────────────────────────────────────────────

  describe('when validating submitted data', () => {
    it('should return 400 when validDue is missing', async () => {
      const req = await adminReq({});
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should return 400 when validDue is in the past', async () => {
      const req = await adminReq({ validDue: new Date(Date.now() - 1000).toISOString() });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should return 400 when maxUsage is 0', async () => {
      const req = await adminReq({ validDue: FUTURE, maxUsage: 0 });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should return 400 when maxUsage exceeds 100', async () => {
      const req = await adminReq({ validDue: FUTURE, maxUsage: 101 });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should return 400 when admin already holds INVITE_TOKEN_MAX_COUNT active tokens', async () => {
      const req = await adminReq({ validDue: FUTURE });
      prismaMock.adminInviteToken.count.mockResolvedValueOnce(INVITE_TOKEN_MAX_COUNT);
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should return 400 when validDue exceeds INVITE_TOKEN_MAX_VALID_DAYS', async () => {
      const tooFar = new Date(
        Date.now() + (INVITE_TOKEN_MAX_VALID_DAYS + 1) * 24 * 60 * 60 * 1_000,
      ).toISOString();
      const req = await adminReq({ validDue: tooFar });
      prismaMock.adminInviteToken.count.mockResolvedValueOnce(0);
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  // ── Success path ──────────────────────────────────────────────────────────

  describe('when an authorized request succeeds', () => {
    it('should return 201 with a raw invite token for a valid request when creating an admin invitation', async () => {
      const req = await adminReq({ validDue: FUTURE });
      prismaMock.adminInviteToken.create.mockResolvedValueOnce({});

      const res = await POST(req);
      const { status, body } = await parseJson<any>(res);

      expect(status).toBe(201);
      expect(typeof body.token).toBe('string');
      expect(body.token.length).toBe(INVITE_TOKEN_LENGTH);
      expect(body.token).toMatch(new RegExp(`^[A-Za-z0-9_-]{${INVITE_TOKEN_LENGTH}}$`));
      expect(body.maxUsage).toBe(1);
      expect(body.manageAdmins).toBe(false);
    });

    it('should apply the requested usage limit and permissions when creating an invitation', async () => {
      const req = await adminReq({ validDue: FUTURE, maxUsage: 10, manageAdmins: true });
      prismaMock.adminInviteToken.create.mockResolvedValueOnce({});

      const res = await POST(req);
      const { body } = await parseJson<any>(res);

      expect(body.maxUsage).toBe(10);
      expect(body.manageAdmins).toBe(true);
    });

    it('should store the token hash, not the raw token, in the database when creating an admin invitation', async () => {
      const req = await adminReq({ validDue: FUTURE });
      prismaMock.adminInviteToken.create.mockResolvedValueOnce({});

      const res = await POST(req);
      const { body } = await parseJson<any>(res);

      const createData = prismaMock.adminInviteToken.create.mock.calls[0][0].data;
      expect(createData.token_hash).not.toBe(body.token);
      expect(createData.token_hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should restrict invitations to the faculty when their creator has faculty-limited access', async () => {
      const req = await adminReq(
        { validDue: FUTURE, restrictedToFaculty: false },
        RESTRICTED_ADMIN_RECORD,
      );
      prismaMock.adminInviteToken.create.mockResolvedValueOnce({});

      await POST(req);

      expect(prismaMock.adminInviteToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ restricted_to_faculty: true }),
        }),
      );
    });

    it('should invalidate invite token cache after successful creation', async () => {
      const req = await adminReq({ validDue: FUTURE });
      prismaMock.adminInviteToken.count.mockResolvedValueOnce(0);
      prismaMock.adminInviteToken.create.mockResolvedValueOnce({});

      await POST(req);

      expect(cacheMock.invalidateInviteTokens).toHaveBeenCalledTimes(1);
    });
  });

  // ── Query efficiency ──────────────────────────────────────────────────────

  it('should count active invitations in one query when enforcing the invitation limit', async () => {
    const req = await adminReq({ validDue: FUTURE });
    prismaMock.adminInviteToken.count.mockResolvedValueOnce(0);
    prismaMock.adminInviteToken.create.mockResolvedValueOnce({});

    await POST(req);

    expect(prismaMock.adminInviteToken.count).toHaveBeenCalledTimes(1);
    expect(prismaMock.adminInviteToken.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ created_by: 'superadmin-001' }),
      }),
    );
  });
});
