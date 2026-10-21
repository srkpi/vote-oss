import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { TEST_NOW } from '@/__tests__/helpers/time';
import {
  ACCESS_TOKEN_TTL_SECS,
  COOKIE_ACCESS,
  COOKIE_REFRESH,
  REFRESH_TOKEN_TTL_SECS,
} from '@/lib/constants';
import {
  signAccessToken,
  signRefreshToken,
  tokenCookieOptions,
  verifyAccessToken,
  verifyRefreshToken,
} from '@/lib/jwt';
import type { TokenPayload } from '@/types/auth';

const BASE_PAYLOAD: TokenPayload = {
  sub: 'user-001',
  faculty: 'FICE',
  group: 'KV-91',
  fullName: 'Ivan Petrenko',
  isAdmin: false,
};

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Session tokens', () => {
  describe('Signing an access token', () => {
    beforeEach(() => {
      allure.feature('JWT');
      allure.story('Access Token');
    });

    it('should return a token string and a jti UUID when signing an access token', async () => {
      const { token, jti } = await signAccessToken(BASE_PAYLOAD);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
      expect(jti).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should produce a unique jti on each call when signing an access token', async () => {
      const a = await signAccessToken(BASE_PAYLOAD);
      const b = await signAccessToken(BASE_PAYLOAD);
      expect(a.jti).not.toBe(b.jti);
    });
  });

  describe('Verifying an access token', () => {
    beforeEach(() => {
      allure.feature('JWT');
      allure.story('Access Token Verification');
    });

    it('should preserve the signed user claims when verifying an access token', async () => {
      const { token } = await signAccessToken(BASE_PAYLOAD);
      const payload = await verifyAccessToken(token);
      expect(payload.sub).toBe(BASE_PAYLOAD.sub);
      expect(payload.faculty).toBe(BASE_PAYLOAD.faculty);
      expect(payload.group).toBe(BASE_PAYLOAD.group);
      expect(payload.fullName).toBe(BASE_PAYLOAD.fullName);
      expect(payload.isAdmin).toBe(BASE_PAYLOAD.isAdmin);
      expect(payload.tokenType).toBe('access');
    });

    it('should include the exact signing time as the iat claim when verifying an access token', async () => {
      const { token } = await signAccessToken(BASE_PAYLOAD);
      const payload = await verifyAccessToken(token);
      expect(payload.iat).toBe(TEST_NOW / 1_000);
    });

    it('should include the jti from the signing result when verifying an access token', async () => {
      const { token, jti } = await signAccessToken(BASE_PAYLOAD);
      const payload = await verifyAccessToken(token);
      expect(payload.jti).toBe(jti);
    });

    it('should reject a refresh token passed as an access token when verifying an access token', async () => {
      const { token } = await signRefreshToken(BASE_PAYLOAD);
      await expect(verifyAccessToken(token)).rejects.toThrow('signature verification failed');
    });

    it('should reject a malformed token when verifying an access token', async () => {
      await expect(verifyAccessToken('garbage.token.here')).rejects.toThrow();
    });
  });

  describe('Verifying a refresh token', () => {
    beforeEach(() => {
      allure.feature('JWT');
      allure.story('Refresh Token');
    });

    it('should preserve the user claims and signing time when verifying a newly signed refresh token', async () => {
      const { token } = await signRefreshToken(BASE_PAYLOAD);
      const payload = await verifyRefreshToken(token);
      expect(payload.tokenType).toBe('refresh');
      expect(payload.sub).toBe(BASE_PAYLOAD.sub);
      expect(payload.iat).toBe(TEST_NOW / 1_000);
    });

    it('should reject an access token passed as a refresh token when verifying a refresh token', async () => {
      const { token } = await signAccessToken(BASE_PAYLOAD);
      await expect(verifyRefreshToken(token)).rejects.toThrow('signature verification failed');
    });
  });

  describe.each([
    {
      name: 'access',
      sign: signAccessToken,
      verify: verifyAccessToken,
      ttl: ACCESS_TOKEN_TTL_SECS,
    },
    {
      name: 'refresh',
      sign: signRefreshToken,
      verify: verifyRefreshToken,
      ttl: REFRESH_TOKEN_TTL_SECS,
    },
  ])('$name token expiry', ({ sign, verify, ttl }) => {
    beforeEach(() => {
      allure.feature('JWT');
      allure.story('Token Expiry');
    });

    it.each([
      { offset: -1, valid: true },
      { offset: 0, valid: false },
      { offset: 1, valid: false },
    ])(
      'should report token validity as $valid when checked $offset seconds from expiration',
      async ({ offset, valid }) => {
        const { token } = await sign(BASE_PAYLOAD);
        vi.setSystemTime(TEST_NOW + (ttl + offset) * 1_000);

        if (valid) {
          await expect(verify(token)).resolves.toMatchObject(BASE_PAYLOAD);
        } else {
          await expect(verify(token)).rejects.toThrow('"exp" claim timestamp check failed');
        }
      },
    );
  });

  describe('Configuring session cookies', () => {
    beforeEach(() => {
      allure.feature('JWT');
      allure.story('Cookie Configuration');
    });

    it('should set httpOnly and sameSite=lax in all environments when configuring session cookies', () => {
      const opts = tokenCookieOptions('access');
      expect(opts.httpOnly).toBe(true);
      expect(opts.sameSite).toBe('lax');
    });

    it('should limit the access cookie lifetime to 15 minutes when configuring session cookies', () => {
      expect(tokenCookieOptions('access').maxAge).toBe(60 * 15);
    });

    it('should limit the refresh cookie lifetime to 7 days when configuring session cookies', () => {
      expect(tokenCookieOptions('refresh').maxAge).toBe(60 * 60 * 24 * 7);
    });

    it('should export stable cookie name constants when configuring session cookies', () => {
      expect(COOKIE_ACCESS).toBe('access_token');
      expect(COOKIE_REFRESH).toBe('refresh_token');
    });
  });
});
