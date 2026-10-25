import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import {
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  JWT_TOKEN_RECORD,
  makeGlobalBypassToken,
  makeTokenPair,
  RESTRICTED_ADMIN_PAYLOAD,
  RESTRICTED_ADMIN_RECORD,
  USER_PAYLOAD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRequest, parseJson } from '@/__tests__/helpers/request';
import { TEST_NOW } from '@/__tests__/helpers/time';
import { resetTokenStoreMock } from '@/__tests__/helpers/token-store-mock';
import { BYPASS_TOKEN_MAX_USAGE_MAX } from '@/lib/constants';

vi.mock('@/lib/prisma', async () => {
  const { prismaMock } = await import('@/__tests__/helpers/prisma-mock');
  return { prisma: prismaMock };
});
vi.mock('@/lib/token-store', async () => {
  const { tokenStoreMock } = await import('@/__tests__/helpers/token-store-mock');
  return tokenStoreMock;
});
// Cache mock for buildAdminGraph in GET route
vi.mock('@/lib/cache', () => ({
  getCachedAdmins: vi.fn().mockResolvedValue(null),
  getCachedElections: vi.fn().mockResolvedValue(null),
}));

import { GET, POST } from '@/app/api/bypass/route';

async function adminReq(body: object = {}) {
  const { access } = await makeTokenPair(ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
  return makeAuthRequest(access.token, { method: 'POST', body });
}

async function restrictedAdminReq(body: object = {}) {
  const { access } = await makeTokenPair(RESTRICTED_ADMIN_PAYLOAD);
  prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
  prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
  return makeAuthRequest(access.token, { method: 'POST', body });
}

const FUTURE_VALID_UNTIL = new Date(TEST_NOW + 2 * 60 * 60 * 1000).toISOString();

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetPrismaMock();
  resetTokenStoreMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Listing global bypass tokens (GET /api/bypass)', () => {
  beforeEach(() => {
    allure.feature('Bypass');
    allure.story('List Global Bypass Tokens');
  });

  it('should return 401 when no user is signed in', async () => {
    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('should return 403 when the admin is faculty-limited and listing global bypass tokens', async () => {
    const { access } = await makeTokenPair(RESTRICTED_ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(RESTRICTED_ADMIN_RECORD);
    const req = makeAuthRequest(access.token, { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('should return 200 with token list including canDelete and canRevokeUsages when listing global bypass tokens', async () => {
    const { access } = await makeTokenPair(ADMIN_PAYLOAD);
    prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
    prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);
    const token = makeGlobalBypassToken({ bypass_graduate: true, max_usage: 5, current_usage: 2 });
    prismaMock.globalBypassToken.findMany.mockResolvedValueOnce([
      {
        ...token,
        creator: { user_id: 'superadmin-001', full_name: 'Super Admin User' },
        usages: [],
      },
    ]);
    // buildAdminGraph: admin.findMany returns empty (no hierarchy needed for owner check)
    prismaMock.admin.findMany.mockResolvedValueOnce([]);

    const req = makeAuthRequest(access.token, { method: 'GET' });
    const { status, body } = await parseJson<any[]>(await GET(req));

    expect(status).toBe(200);
    expect(body[0].bypassGraduate).toBe(true);
    expect(body[0].maxUsage).toBe(5);
    expect(body[0].currentUsage).toBe(2);
    expect(body[0].canDelete).toBe(true);
    expect(body[0].canRevokeUsages).toBe(true);
  });
});

describe('Creating a global bypass token (POST /api/bypass)', () => {
  beforeEach(() => {
    allure.feature('Bypass');
    allure.story('Create Global Bypass Token');
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  describe('when checking caller access', () => {
    it('should return 401 when no user is signed in', async () => {
      const req = makeRequest({ method: 'POST', body: {} });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('should return 403 for non-admin user when creating a global bypass token', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
      const req = makeAuthRequest(access.token, { method: 'POST', body: {} });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it('should return 403 when the admin is faculty-limited and creating a global bypass token', async () => {
      const req = await restrictedAdminReq({
        bypassNotStudying: true,
        maxUsage: 1,
        validUntil: FUTURE_VALID_UNTIL,
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });
  });

  // ── Bypass option validation ──────────────────────────────────────────────

  describe('when selecting the bypassed eligibility checks', () => {
    it('should return 400 when neither bypassNotStudying nor bypassGraduate is set', async () => {
      const req = await adminReq({ maxUsage: 1, validUntil: FUTURE_VALID_UNTIL });
      const { status, body } = await parseJson<any>(await POST(req));
      expect(status).toBe(400);
      expect(body.message).toMatch(/at least one bypass option/i);
    });

    it('should return 400 when both bypass flags are explicitly false', async () => {
      const req = await adminReq({
        bypassNotStudying: false,
        bypassGraduate: false,
        maxUsage: 1,
        validUntil: FUTURE_VALID_UNTIL,
      });
      const { status } = await parseJson<any>(await POST(req));
      expect(status).toBe(400);
    });

    it('should accept bypassNotStudying: true only when creating a global bypass token', async () => {
      const req = await adminReq({
        bypassNotStudying: true,
        maxUsage: 1,
        validUntil: FUTURE_VALID_UNTIL,
      });
      const { status } = await parseJson<any>(await POST(req));
      expect(status).toBe(201);
    });

    it('should accept bypassGraduate: true only when creating a global bypass token', async () => {
      const req = await adminReq({
        bypassGraduate: true,
        maxUsage: 1,
        validUntil: FUTURE_VALID_UNTIL,
      });
      const { status } = await parseJson<any>(await POST(req));
      expect(status).toBe(201);
    });

    it('should accept both bypass flags set to true when creating a global bypass token', async () => {
      const req = await adminReq({
        bypassNotStudying: true,
        bypassGraduate: true,
        maxUsage: 1,
        validUntil: FUTURE_VALID_UNTIL,
      });
      const { status, body } = await parseJson<any>(await POST(req));
      expect(status).toBe(201);
      expect(body.bypassNotStudying).toBe(true);
      expect(body.bypassGraduate).toBe(true);
    });
  });

  // ── maxUsage validation ────────────────────────────────────────────────────

  describe('when validating the bypass usage limit', () => {
    it('should return 400 when maxUsage not provided', async () => {
      const req = await adminReq({
        bypassNotStudying: true,
        validUntil: FUTURE_VALID_UNTIL,
      });
      const { status, body } = await parseJson<any>(await POST(req));
      expect(status).toBe(400);
      expect(body.message).toMatch(/maxUsage/);
    });

    it('should return 400 when maxUsage exceeds BYPASS_TOKEN_MAX_USAGE_MAX', async () => {
      const req = await adminReq({
        bypassNotStudying: true,
        maxUsage: BYPASS_TOKEN_MAX_USAGE_MAX + 1,
        validUntil: FUTURE_VALID_UNTIL,
      });
      const { status, body } = await parseJson<any>(await POST(req));
      expect(status).toBe(400);
      expect(body.message).toMatch(new RegExp(String(BYPASS_TOKEN_MAX_USAGE_MAX)));
    });

    it('should return 400 when maxUsage is zero', async () => {
      const req = await adminReq({
        bypassNotStudying: true,
        maxUsage: 0,
        validUntil: FUTURE_VALID_UNTIL,
      });
      const { status } = await parseJson<any>(await POST(req));
      expect(status).toBe(400);
    });

    it('should return 400 when maxUsage is negative', async () => {
      const req = await adminReq({
        bypassNotStudying: true,
        maxUsage: -1,
        validUntil: FUTURE_VALID_UNTIL,
      });
      const { status } = await parseJson<any>(await POST(req));
      expect(status).toBe(400);
    });

    it(`accepts maxUsage = ${BYPASS_TOKEN_MAX_USAGE_MAX}`, async () => {
      const req = await adminReq({
        bypassNotStudying: true,
        maxUsage: BYPASS_TOKEN_MAX_USAGE_MAX,
        validUntil: FUTURE_VALID_UNTIL,
      });
      const { status, body } = await parseJson<any>(await POST(req));
      expect(status).toBe(201);
      expect(body.maxUsage).toBe(BYPASS_TOKEN_MAX_USAGE_MAX);
    });
  });

  // ── Successful creation ────────────────────────────────────────────────────

  describe('when bypass creation succeeds', () => {
    it('should store bypass_graduate in the database when creating a global bypass token', async () => {
      const req = await adminReq({
        bypassGraduate: true,
        maxUsage: 1,
        validUntil: FUTURE_VALID_UNTIL,
      });
      await POST(req);
      expect(prismaMock.globalBypassToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ bypass_graduate: true, bypass_not_studying: false }),
        }),
      );
    });

    it('should store max_usage in the database when creating a global bypass token', async () => {
      const req = await adminReq({
        bypassNotStudying: true,
        maxUsage: 10,
        validUntil: FUTURE_VALID_UNTIL,
      });
      await POST(req);
      expect(prismaMock.globalBypassToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ max_usage: 10, current_usage: 0 }),
        }),
      );
    });
  });
});
