import * as allure from 'allure-js-commons';
import { prismaMock, resetPrismaMock } from '../helpers/prisma-mock';
import { makeRequest, makeAuthRequest, makeRefreshRequest } from '../helpers/request';
import {
  makeTokenPair,
  USER_PAYLOAD,
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  JWT_TOKEN_RECORD,
} from '../helpers/fixtures';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { requireAuth, requireRefreshAuth, requireAdmin } from '@/lib/auth';

describe('auth', () => {
  beforeEach(() => {
    resetPrismaMock();
    allure.feature('Auth Middleware');
  });

  describe('requireAuth', () => {
    beforeEach(() => allure.story('requireAuth'));

    it('returns ok=false when access token cookie is absent', async () => {
      const req = makeRequest();
      const result = await requireAuth(req);
      expect(result.ok).toBe(false);
      expect((result as any).error).toMatch(/Missing/i);
    });

    it('returns ok=false for a malformed token', async () => {
      const req = makeAuthRequest('not.a.valid.jwt');
      const result = await requireAuth(req);
      expect(result.ok).toBe(false);
      expect((result as any).error).toMatch(/Invalid/i);
    });

    it('returns ok=false when jti is not found in the database (revoked)', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(null);

      const req = makeAuthRequest(access.token);
      const result = await requireAuth(req);
      expect(result.ok).toBe(false);
      expect((result as any).error).toMatch(/revoked/i);
    });

    it('returns ok=true and user payload when token is valid and active', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);

      const req = makeAuthRequest(access.token);
      const result = await requireAuth(req);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.user.sub).toBe(USER_PAYLOAD.sub);
        expect(result.user.faculty).toBe(USER_PAYLOAD.faculty);
        expect(result.user.is_admin).toBe(false);
        expect(typeof result.user.jti).toBe('string');
      }
    });

    it('queries the DB with the correct jti from the token', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);

      const req = makeAuthRequest(access.token);
      await requireAuth(req);

      expect(prismaMock.jwtToken.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { access_jti: access.jti } }),
      );
    });
  });

  describe('requireRefreshAuth', () => {
    beforeEach(() => allure.story('requireRefreshAuth'));

    it('returns ok=false when refresh token cookie is absent', async () => {
      const req = makeRequest();
      const result = await requireRefreshAuth(req);
      expect(result.ok).toBe(false);
      expect((result as any).error).toMatch(/Missing/i);
    });

    it('returns ok=false when refresh token is revoked in DB', async () => {
      const { refresh } = await makeTokenPair(USER_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(null);

      const req = makeRefreshRequest(refresh.token);
      const result = await requireRefreshAuth(req);
      expect(result.ok).toBe(false);
    });

    it('returns ok=true with correct user for valid refresh token', async () => {
      const { refresh } = await makeTokenPair(USER_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);

      const req = makeRefreshRequest(refresh.token);
      const result = await requireRefreshAuth(req);
      expect(result.ok).toBe(true);
    });

    it('rejects an access token passed in the refresh cookie slot', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      const req = makeRefreshRequest(access.token);
      const result = await requireRefreshAuth(req);
      expect(result.ok).toBe(false);
    });
  });

  describe('requireAdmin', () => {
    beforeEach(() => allure.story('requireAdmin'));

    it('returns ok=false when user is not an admin (is_admin=false)', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);

      const req = makeAuthRequest(access.token);
      const result = await requireAdmin(req);
      expect(result.ok).toBe(false);
      expect((result as any).error).toMatch(/Admin access required/i);
    });

    it('returns ok=false when admin JWT flag is true but DB record is missing', async () => {
      const { access } = await makeTokenPair(ADMIN_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
      prismaMock.admin.findUnique.mockResolvedValueOnce(null);

      const req = makeAuthRequest(access.token);
      const result = await requireAdmin(req);
      expect(result.ok).toBe(false);
      expect((result as any).error).toMatch(/Admin record not found/i);
    });

    it('returns ok=true with admin record for a valid admin', async () => {
      const { access } = await makeTokenPair(ADMIN_PAYLOAD);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
      prismaMock.admin.findUnique.mockResolvedValueOnce(ADMIN_RECORD);

      const req = makeAuthRequest(access.token);
      const result = await requireAdmin(req);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect((result as any).admin.user_id).toBe(ADMIN_RECORD.user_id);
        expect((result as any).admin.manage_admins).toBe(true);
      }
    });
  });
});
