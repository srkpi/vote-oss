import * as allure from 'allure-js-commons';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  tokenCookieOptions,
  COOKIE_ACCESS,
  COOKIE_REFRESH,
} from '@/lib/jwt';

const BASE_PAYLOAD = {
  sub: 'user-001',
  faculty: 'FICE',
  group: 'KV-91',
  full_name: 'Ivan Petrenko',
  is_admin: false,
  restricted_to_faculty: false,
  manage_admins: false,
};

describe('jwt', () => {
  describe('signAccessToken', () => {
    beforeEach(() => {
      allure.feature('JWT');
      allure.story('Access Token');
    });

    it('returns a token string and a jti UUID', async () => {
      const { token, jti } = await signAccessToken(BASE_PAYLOAD);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
      expect(jti).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('produces unique jti on each call', async () => {
      const a = await signAccessToken(BASE_PAYLOAD);
      const b = await signAccessToken(BASE_PAYLOAD);
      expect(a.jti).not.toBe(b.jti);
    });

    it('throws when JWT_ACCESS_SECRET is missing', async () => {
      const original = process.env.JWT_ACCESS_SECRET;
      delete process.env.JWT_ACCESS_SECRET;
      await expect(signAccessToken(BASE_PAYLOAD)).rejects.toThrow('JWT_ACCESS_SECRET is not set');
      process.env.JWT_ACCESS_SECRET = original;
    });
  });

  describe('verifyAccessToken', () => {
    beforeEach(() => {
      allure.feature('JWT');
      allure.story('Access Token Verification');
    });

    it('decodes all payload fields correctly', async () => {
      const { token } = await signAccessToken(BASE_PAYLOAD);
      const payload = await verifyAccessToken(token);
      expect(payload.sub).toBe(BASE_PAYLOAD.sub);
      expect(payload.faculty).toBe(BASE_PAYLOAD.faculty);
      expect(payload.group).toBe(BASE_PAYLOAD.group);
      expect(payload.full_name).toBe(BASE_PAYLOAD.full_name);
      expect(payload.is_admin).toBe(BASE_PAYLOAD.is_admin);
      expect(payload.token_type).toBe('access');
    });

    it('rejects a refresh token passed as access token', async () => {
      const { token } = await signRefreshToken(BASE_PAYLOAD);
      await expect(verifyAccessToken(token)).rejects.toThrow('signature verification failed');
    });

    it('rejects a malformed token', async () => {
      await expect(verifyAccessToken('garbage.token.here')).rejects.toThrow();
    });

    it('rejects a token signed with wrong secret', async () => {
      const orig = process.env.JWT_ACCESS_SECRET;
      process.env.JWT_ACCESS_SECRET = 'wrong-secret-that-is-also-long-enough-00';
      const { token } = await signAccessToken(BASE_PAYLOAD);
      process.env.JWT_ACCESS_SECRET = orig;
      await expect(verifyAccessToken(token)).rejects.toThrow();
    });
  });

  describe('signRefreshToken / verifyRefreshToken', () => {
    beforeEach(() => {
      allure.feature('JWT');
      allure.story('Refresh Token');
    });

    it('round-trip encodes and decodes correctly', async () => {
      const { token } = await signRefreshToken(BASE_PAYLOAD);
      const payload = await verifyRefreshToken(token);
      expect(payload.token_type).toBe('refresh');
      expect(payload.sub).toBe(BASE_PAYLOAD.sub);
    });

    it('rejects an access token passed as refresh token', async () => {
      const { token } = await signAccessToken(BASE_PAYLOAD);
      await expect(verifyRefreshToken(token)).rejects.toThrow('signature verification failed');
    });
  });

  describe('tokenCookieOptions', () => {
    beforeEach(() => {
      allure.feature('JWT');
      allure.story('Cookie Configuration');
    });

    it('sets httpOnly and sameSite=lax in all environments', () => {
      const opts = tokenCookieOptions('access');
      expect(opts.httpOnly).toBe(true);
      expect(opts.sameSite).toBe('lax');
    });

    it('does NOT set secure flag when NODE_ENV is not production', () => {
      (process.env.NODE_ENV as string) = 'test';
      expect(tokenCookieOptions('access').secure).toBe(false);
    });

    it('sets secure flag when NODE_ENV is production', () => {
      (process.env.NODE_ENV as string) = 'production';
      expect(tokenCookieOptions('access').secure).toBe(true);
      (process.env.NODE_ENV as string) = 'test';
    });

    it('access token maxAge is 15 minutes', () => {
      expect(tokenCookieOptions('access').maxAge).toBe(60 * 15);
    });

    it('refresh token maxAge is 7 days', () => {
      expect(tokenCookieOptions('refresh').maxAge).toBe(60 * 60 * 24 * 7);
    });

    it('exports stable cookie name constants', () => {
      expect(COOKIE_ACCESS).toBe('access_token');
      expect(COOKIE_REFRESH).toBe('refresh_token');
    });
  });
});
