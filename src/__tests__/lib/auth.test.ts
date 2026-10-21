import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import {
  ADMIN_PAYLOAD,
  ADMIN_RECORD,
  makeTokenPair,
  USER_PAYLOAD,
} from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { makeAuthRequest, makeRefreshRequest, makeRequest } from '@/__tests__/helpers/request';
import { TEST_NOW } from '@/__tests__/helpers/time';
import { resetTokenStoreMock, tokenStoreMock } from '@/__tests__/helpers/token-store-mock';

vi.mock('@/lib/prisma', async () => {
  const { prismaMock } = await import('@/__tests__/helpers/prisma-mock');
  return { prisma: prismaMock };
});
vi.mock('@/lib/token-store', async () => {
  const { tokenStoreMock } = await import('@/__tests__/helpers/token-store-mock');
  return tokenStoreMock;
});

import { requireAdmin, requireAuth, requireRefreshAuth } from '@/lib/auth';

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetPrismaMock();
  resetTokenStoreMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Session access', () => {
  beforeEach(() => {
    allure.feature('Auth Middleware');
  });

  // ── requireAuth ───────────────────────────────────────────────────────────

  describe('Authenticating an access token', () => {
    beforeEach(() => allure.story('requireAuth'));

    it('should deny access with 401 when the access-token cookie is absent', async () => {
      const req = makeRequest();
      const result = await requireAuth(req);
      expect(result.ok).toBe(false);
      expect((result as any).error).toMatch(/Missing/i);
      expect((result as any).status).toBe(401);
    });

    it('should deny access with 401 when the access token is malformed', async () => {
      const req = makeAuthRequest('not.a.valid.jwt');
      const result = await requireAuth(req);
      expect(result.ok).toBe(false);
      expect((result as any).error).toMatch(/Invalid/i);
    });

    it('should deny access with 401 when the access token has been revoked', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(false);

      const req = makeAuthRequest(access.token);
      const result = await requireAuth(req);
      expect(result.ok).toBe(false);
      expect((result as any).error).toMatch(/revoked/i);
    });

    it('should authenticate the token owner when the access token is valid', async () => {
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

    it('should expose iat in the verified payload when authenticating an access token', async () => {
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

    it('should check revocation for the verified token ID and issue time when authenticating an access token', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);

      const req = makeAuthRequest(access.token);
      await requireAuth(req);

      expect(tokenStoreMock.isAccessTokenValid).toHaveBeenCalledWith(
        access.jti,
        expect.any(Number), // iat
      );
    });

    it('should use the revocation lookup without an extra session query when authenticating an access token', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);

      const req = makeAuthRequest(access.token);
      await requireAuth(req);
      expect(prismaMock.jwtToken.findFirst).not.toHaveBeenCalled();
    });
  });

  // ── requireRefreshAuth ────────────────────────────────────────────────────

  describe('Authenticating a refresh token', () => {
    beforeEach(() => allure.story('requireRefreshAuth'));

    it('should deny session renewal when the refresh-token cookie is absent', async () => {
      const req = makeRequest();
      const result = await requireRefreshAuth(req);
      expect(result.ok).toBe(false);
      expect((result as any).error).toMatch(/Missing/i);
    });

    it('should deny session renewal when the refresh token has been revoked', async () => {
      const { refresh } = await makeTokenPair(USER_PAYLOAD);
      tokenStoreMock.isRefreshTokenValid.mockResolvedValueOnce(false);

      const req = makeRefreshRequest(refresh.token);
      const result = await requireRefreshAuth(req);
      expect(result.ok).toBe(false);
    });

    it('should authenticate the token owner when their refresh token is valid', async () => {
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

    it('should reject an access token placed in the refresh cookie slot when authenticating a refresh token', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      const req = makeRefreshRequest(access.token);
      const result = await requireRefreshAuth(req);
      expect(result.ok).toBe(false);
    });

    it('should check revocation for the verified token ID and issue time when authenticating a refresh token', async () => {
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

  describe('Checking admin access', () => {
    beforeEach(() => allure.story('requireAdmin'));

    it('should deny admin access when the access-token cookie is absent', async () => {
      const req = makeRequest();
      const result = await requireAdmin(req);
      expect(result.ok).toBe(false);
    });

    it('should deny admin access with 403 when the session has no admin claim', async () => {
      const { access } = await makeTokenPair(USER_PAYLOAD);
      tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);

      const req = makeAuthRequest(access.token);
      const result = await requireAdmin(req);
      expect(result.ok).toBe(false);
      expect((result as any).error).toMatch(/Admin access required/i);
      expect((result as any).status).toBe(403);
    });

    it('should deny admin access with 403 when the session claims admin access without an active admin record', async () => {
      const { access } = await makeTokenPair(ADMIN_PAYLOAD);
      tokenStoreMock.isAccessTokenValid.mockResolvedValueOnce(true);
      prismaMock.admin.findUnique.mockResolvedValueOnce(null);

      const req = makeAuthRequest(access.token);
      const result = await requireAdmin(req);
      expect(result.ok).toBe(false);
      expect((result as any).error).toMatch(/Admin record not found/i);
    });

    it('should grant admin access and return the admin profile when authentication and admin checks pass', async () => {
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
