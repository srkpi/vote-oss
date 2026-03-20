import * as allure from 'allure-js-commons';

import {
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  makeTokenPair,
  USER_PAYLOAD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRefreshRequest, makeRequest } from '@/__tests__/helpers/request';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/token-store', () => tokenStoreMock);

import { requireAdmin, requireAuth, requireRefreshAuth } from '@/lib/auth';

describe('auth', () => {
  beforeEach(() => {
    resetPrismaMock();
    resetTokenStoreMock();
    allure.feature('Auth Middleware');
  });

  // ── requireAuth ───────────────────────────────────────────────────────────

  describe('requireAuth', () => {
    beforeEach(() => allure.story('requireAuth'));

    it('returns ok=false (401) when access token cookie is absent', async () => {
      const req = makeRequest();
      const result = await requireAuth(req);
      expect(result.ok).toBe(false);
      expect((result as any).error).toMatch(/Missing/i);
      expect((result as any).status).toBe(401);
    });

    it('returns ok=false (401) for a malformed token string', async () => {
      const req = makeAuthRequest('not.a.valid.jwt');
      const result = await requireAuth(req);
      expect(result.ok).toBe(false);
      expect((result as any).error).toMatch(/Invalid/i);
    });

    it('returns ok=false (401) when isAccessTokenValid returns false (revoked)', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(false);

      const req = makeAuthRequest(access.token);
      const result = await requireAuth(req);
      expect(result.ok).toBe(false);
      expect((result as any).error).toMatch(/revoked/i);
    });

    it('returns ok=true with user payload when token is valid', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);

      const req = makeAuthRequest(access.token);
      const result = await requireAuth(req);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.user.sub).toBe(USER_PAYLOAD.sub);
        expect(result.user.faculty).toBe(USER_PAYLOAD.faculty);
        expect(result.user.isAdmin).toBe(false);
        expect(typeof result.user.jti).toBe('string');
      }
    });

    it('exposes iat in the verified payload', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);

      const req = makeAuthRequest(access.token);
      const result = await requireAuth(req);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(typeof result.user.iat).toBe('number');
        expect(result.user.iat).toBeGreaterThan(0);
      }
    });

    it('calls isAccessTokenValid with the jti and iat from the token', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);

      const req = makeAuthRequest(access.token);
      await requireAuth(req);

      expect(tokenStoreMock.isAccessTokenValid).toHaveBeenCalledWith(
        access.jti,
        expect.any(Number), // iat
      );
    });

    it('does not call prisma.jwtToken.findFirst directly (hot path uses token-store)', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);

      const req = makeAuthRequest(access.token);
      await requireAuth(req);
      expect(prismaMock.jwtToken.findFirst).not.toHaveBeenCalled();
    });
  });

  // ── requireRefreshAuth ────────────────────────────────────────────────────

  describe('requireRefreshAuth', () => {
    beforeEach(() => allure.story('requireRefreshAuth'));

    it('returns ok=false when refresh token cookie is absent', async () => {
      const req = makeRequest();
      const result = await requireRefreshAuth(req);
      expect(result.ok).toBe(false);
      expect((result as any).error).toMatch(/Missing/i);
    });

    it('returns ok=false when isRefreshTokenValid returns false', async () => {
      const { refresh } = await makeTokenPair(USER_PAYLOAD);
      tokenStoreMock.isRefreshTokenValid.mockResolvedValueOnce(false);

      const req = makeRefreshRequest(refresh.token);
      const result = await requireRefreshAuth(req);
      expect(result.ok).toBe(false);
    });

    it('returns ok=true with correct user for a valid refresh token', async () => {
      const { refresh } = await makeTokenPair(USER_PAYLOAD);
      tokenStoreMock.isRefreshTokenValid.mockResolvedValueOnce(true);

      const req = makeRefreshRequest(refresh.token);
      const result = await requireRefreshAuth(req);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.user.sub).toBe(USER_PAYLOAD.sub);
        expect(result.user.tokenType).toBe('refresh');
      }
    });

    it('rejects an access token placed in the refresh cookie slot', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      const req = makeRefreshRequest(access.token);
      const result = await requireRefreshAuth(req);
      expect(result.ok).toBe(false);
    });

    it('calls isRefreshTokenValid with the correct jti and iat', async () => {
      const { refresh } = await makeTokenPair(USER_PAYLOAD);
      tokenStoreMock.isRefreshTokenValid.mockResolvedValueOnce(true);

      const req = makeRefreshRequest(refresh.token);
      await requireRefreshAuth(req);

      expect(tokenStoreMock.isRefreshTokenValid).toHaveBeenCalledWith(
        refresh.jti,
        expect.any(Number),
      );
    });
  });

  // ── requireAdmin ──────────────────────────────────────────────────────────

  describe('requireAdmin', () => {
    beforeEach(() => allure.story('requireAdmin'));

    it('returns ok=false when auth fails (no cookie)', async () => {
      const req = makeRequest();
      const result = await requireAdmin(req);
      expect(result.ok).toBe(false);
    });

    it('returns ok=false (403) when is_admin flag is false', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);

      const req = makeAuthRequest(access.token);
      const result = await requireAdmin(req);
      expect(result.ok).toBe(false);
      expect((result as any).error).toMatch(/Admin access required/i);
      expect((result as any).status).toBe(403);
    });

    it('returns ok=false (403) when is_admin=true but DB record is missing', async () => {
      const { access } = await makeTokenPair(ADMIN_PAYLOAD);
      tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);
      prismaMock.admin.findUnique.mockResolvedValueOnce(null);

      const req = makeAuthRequest(access.token);
      const result = await requireAdmin(req);
      expect(result.ok).toBe(false);
      expect((result as any).error).toMatch(/Admin record not found/i);
    });

    it('returns ok=true with admin record when all checks pass', async () => {
      const { access } = await makeTokenPair(ADMIN_PAYLOAD);
      tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);
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
