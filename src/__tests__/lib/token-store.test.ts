import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { bloomMock, resetBloomMock } from '@/__tests__/helpers/bloom-mock';
import { JWT_TOKEN_RECORD } from '@/__tests__/helpers/fixtures';
import { prismaMock, resetPrismaMock } from '@/__tests__/helpers/prisma-mock';
import { TEST_NOW } from '@/__tests__/helpers/time';

vi.mock('@/lib/bloom', async () => {
  const { bloomMock } = await import('@/__tests__/helpers/bloom-mock');
  return bloomMock;
});
vi.mock('@/lib/prisma', async () => {
  const { prismaMock } = await import('@/__tests__/helpers/prisma-mock');
  return { prisma: prismaMock };
});

import { ACCESS_TOKEN_TTL_SECS, REFRESH_TOKEN_TTL_SECS } from '@/lib/constants';
import {
  isAccessTokenValid,
  isRefreshTokenValid,
  persistTokenPair,
  revokeByAccessJti,
  revokeByRefreshJti,
  revokeTokenPair,
} from '@/lib/token-store';

const NOW_SECS = Math.floor(TEST_NOW / 1_000);
// iat 5 seconds ago (well within access token lifetime)
const RECENT_IAT = NOW_SECS - 5;

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetPrismaMock();
  resetBloomMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Session persistence and revocation', () => {
  beforeEach(() => {
    allure.feature('Token Store');
  });

  describe('Saving a session', () => {
    beforeEach(() => allure.story('persistTokenPair'));

    it('should create a jwtToken DB record with the given JTIs when saving a session', async () => {
      prismaMock.jwtToken.create.mockResolvedValueOnce({});
      const initialAuthAt = new Date();
      await persistTokenPair('access-jti', 'refresh-jti', initialAuthAt);
      expect(prismaMock.jwtToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          access_jti: 'access-jti',
          refresh_jti: 'refresh-jti',
          initial_auth_at: initialAuthAt,
        }),
      });
    });

    it('should include created_at timestamp when saving a session', async () => {
      prismaMock.jwtToken.create.mockResolvedValueOnce({});
      await persistTokenPair('a', 'b', new Date());
      const { data } = prismaMock.jwtToken.create.mock.calls[0][0];
      expect(data.created_at).toBeInstanceOf(Date);
    });
  });

  describe('Checking an access token', () => {
    beforeEach(() => allure.story('isAccessTokenValid'));

    it('should fall back to DB when iat predates the bloom reset and record exists', async () => {
      bloomMock.getBloomResetAt.mockResolvedValueOnce(Date.now());
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce({ access_jti: 'jti' });

      expect(await isAccessTokenValid('jti', NOW_SECS - 10)).toBe(true);
    });

    it('should fall back to DB when iat predates the bloom reset and record does not exist', async () => {
      bloomMock.getBloomResetAt.mockResolvedValueOnce(Date.now());
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(null);

      expect(await isAccessTokenValid('jti', NOW_SECS - 10)).toBe(false);
    });

    it('should not reject when iat is after the bloom reset', async () => {
      const pastResetAt = Date.now() - 10_000; // 10s ago
      bloomMock.getBloomResetAt.mockResolvedValueOnce(pastResetAt);
      bloomMock.isTokenClean.mockResolvedValueOnce(true);
      expect(await isAccessTokenValid('jti', NOW_SECS)).toBe(true);
    });

    it('should return true immediately when bloom says CLEAN (no DB call)', async () => {
      bloomMock.isTokenClean.mockResolvedValueOnce(true);
      expect(await isAccessTokenValid('jti', RECENT_IAT)).toBe(true);
      expect(prismaMock.jwtToken.findFirst).not.toHaveBeenCalled();
    });

    it('should return false immediately when bloom says REVOKED (no DB call)', async () => {
      bloomMock.isTokenClean.mockResolvedValueOnce(false);
      expect(await isAccessTokenValid('jti', RECENT_IAT)).toBe(false);
      expect(prismaMock.jwtToken.findFirst).not.toHaveBeenCalled();
    });

    it('should fall back to DB when bloom returns null (Redis unavailable) and record exists', async () => {
      bloomMock.isTokenClean.mockResolvedValueOnce(null);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce({ access_jti: 'jti' });
      expect(await isAccessTokenValid('jti', RECENT_IAT)).toBe(true);
    });

    it('should fall back to DB when bloom returns null and record is absent → returns false', async () => {
      bloomMock.isTokenClean.mockResolvedValueOnce(null);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(null);
      expect(await isAccessTokenValid('jti', RECENT_IAT)).toBe(false);
    });

    it('should look up the access token by its verified ID when revocation lookup requires stored session data', async () => {
      bloomMock.isTokenClean.mockResolvedValueOnce(null);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
      await isAccessTokenValid('my-jti', RECENT_IAT);
      expect(prismaMock.jwtToken.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { access_jti: 'my-jti' } }),
      );
    });

    it('should skip the reset-time gate when resetAt is 0 (disabled)', async () => {
      bloomMock.getBloomResetAt.mockResolvedValueOnce(0);
      bloomMock.isTokenClean.mockResolvedValueOnce(true);
      // Very old iat but resetAt=0 → gate is off → should still pass
      expect(await isAccessTokenValid('jti', 1_000)).toBe(true);
    });
  });

  describe('Checking a refresh token', () => {
    beforeEach(() => allure.story('isRefreshTokenValid'));

    it('should fall back to DB when iat predates the bloom reset and record exists', async () => {
      bloomMock.getBloomResetAt.mockResolvedValueOnce(Date.now());
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce({ refresh_jti: 'jti' });

      expect(await isRefreshTokenValid('jti', NOW_SECS - 10)).toBe(true);
    });

    it('should fall back to DB when iat predates the bloom reset and record does not exist', async () => {
      bloomMock.getBloomResetAt.mockResolvedValueOnce(Date.now());
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(null);

      expect(await isRefreshTokenValid('jti', NOW_SECS - 10)).toBe(false);
    });

    it('should return true from bloom fast-path when checking a refresh token', async () => {
      bloomMock.isTokenClean.mockResolvedValueOnce(true);
      expect(await isRefreshTokenValid('jti', RECENT_IAT)).toBe(true);
      expect(prismaMock.jwtToken.findFirst).not.toHaveBeenCalled();
    });

    it('should fall back to DB with refresh_jti selector when checking a refresh token', async () => {
      bloomMock.isTokenClean.mockResolvedValueOnce(null);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce({ refresh_jti: 'jti' });
      await isRefreshTokenValid('jti', RECENT_IAT);
      expect(prismaMock.jwtToken.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { refresh_jti: 'jti' } }),
      );
    });
  });

  describe.each([
    { name: 'access', validate: isAccessTokenValid },
    { name: 'refresh', validate: isRefreshTokenValid },
  ])('$name token bloom reset boundary', ({ validate }) => {
    beforeEach(() => allure.story('Bloom Reset Boundary'));

    it.each([
      { offset: -1, valid: false },
      { offset: 0, valid: true },
      { offset: 1, valid: true },
    ])(
      'should report token validity as $valid when issued $offset seconds from the revocation filter reset',
      async ({ offset, valid }) => {
        bloomMock.getBloomResetAt.mockResolvedValueOnce(TEST_NOW);
        bloomMock.isTokenClean.mockResolvedValueOnce(true);
        prismaMock.jwtToken.findFirst.mockResolvedValueOnce(null);

        expect(await validate('jti', NOW_SECS + offset)).toBe(valid);
        expect(prismaMock.jwtToken.findFirst).toHaveBeenCalledTimes(valid ? 0 : 1);
        expect(bloomMock.isTokenClean).toHaveBeenCalledTimes(valid ? 1 : 0);
      },
    );
  });

  describe('Revoking an access token', () => {
    beforeEach(() => allure.story('revokeByAccessJti'));

    it('should mark the access token as revoked immediately when signing out its session', async () => {
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(null);
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      await revokeByAccessJti('access-jti', NOW_SECS - 5);
      expect(bloomMock.bloomAdd).toHaveBeenCalledWith('access-jti', expect.any(Number));
    });

    it('should delete the DB record by access_jti when revoking an access token', async () => {
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(null);
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      await revokeByAccessJti('access-jti', NOW_SECS - 5);
      expect(prismaMock.jwtToken.deleteMany).toHaveBeenCalledWith({
        where: { access_jti: 'access-jti' },
      });
    });

    it('should mark the paired refresh token as revoked when its saved session is found', async () => {
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce({
        refresh_jti: 'refresh-jti',
        created_at: new Date(Date.now() - 5_000),
      });
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      await revokeByAccessJti('access-jti', NOW_SECS - 5);

      const calls = bloomMock.bloomAdd.mock.calls.map((c) => c[0]);
      expect(calls).toContain('refresh-jti');
    });

    it('should skip refresh bloom-add when no sibling record is found', async () => {
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(null);
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 0 });
      await revokeByAccessJti('access-jti', NOW_SECS - 5);
      // Only the access token itself should be bloom-added
      expect(bloomMock.bloomAdd).toHaveBeenCalledTimes(1);
    });

    it('should clamp TTL to minimum 1 when token has already expired', async () => {
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(null);
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 0 });
      // iat far in the past
      await revokeByAccessJti('access-jti', 1_000);
      const ttl = bloomMock.bloomAdd.mock.calls[0][1] as number;
      expect(ttl).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Revoking a refresh token', () => {
    beforeEach(() => allure.story('revokeByRefreshJti'));

    it('should look up the sibling access JTI from DB when revoking a refresh token', async () => {
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce({ access_jti: 'access-jti' });
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      await revokeByRefreshJti('refresh-jti', RECENT_IAT);
      expect(prismaMock.jwtToken.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { refresh_jti: 'refresh-jti' } }),
      );
    });

    it('should mark the refresh token as revoked when replacing its session tokens', async () => {
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(null);
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      await revokeByRefreshJti('refresh-jti', RECENT_IAT);
      expect(bloomMock.bloomAdd).toHaveBeenCalledWith('refresh-jti', expect.any(Number));
    });

    it('should mark the paired access token as revoked when the saved session is found', async () => {
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce({ access_jti: 'access-jti' });
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      await revokeByRefreshJti('refresh-jti', RECENT_IAT);
      const addedJtis = bloomMock.bloomAdd.mock.calls.map((c) => c[0]);
      expect(addedJtis).toContain('access-jti');
    });

    it('should return the sibling access JTI when revoking a refresh token', async () => {
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce({ access_jti: 'access-jti' });
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      const result = await revokeByRefreshJti('refresh-jti', RECENT_IAT);
      expect(result.accessJti).toBe('access-jti');
    });

    it('should return null accessJti when no DB record is found', async () => {
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(null);
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 0 });
      const result = await revokeByRefreshJti('refresh-jti', RECENT_IAT);
      expect(result.accessJti).toBeNull();
    });

    it('should delete the DB record by refresh_jti when revoking a refresh token', async () => {
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(null);
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      await revokeByRefreshJti('refresh-jti', RECENT_IAT);
      expect(prismaMock.jwtToken.deleteMany).toHaveBeenCalledWith({
        where: { refresh_jti: 'refresh-jti' },
      });
    });
  });

  describe('Revoking a session', () => {
    beforeEach(() => allure.story('revokeTokenPair'));

    it('should mark both session tokens as revoked when the session is terminated', async () => {
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      await revokeTokenPair('acc-jti', 'ref-jti', RECENT_IAT, RECENT_IAT);
      const addedJtis = bloomMock.bloomAdd.mock.calls.map((c) => c[0]);
      expect(addedJtis).toContain('acc-jti');
      expect(addedJtis).toContain('ref-jti');
    });

    it('should delete the DB record by access_jti when revoking a session', async () => {
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      await revokeTokenPair('acc-jti', 'ref-jti', RECENT_IAT, RECENT_IAT);
      expect(prismaMock.jwtToken.deleteMany).toHaveBeenCalledWith({
        where: { access_jti: 'acc-jti' },
      });
    });

    it('should keep the access token revocation until its remaining lifetime ends when terminating a session', async () => {
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      const iat = NOW_SECS - 60; // 60 seconds ago
      await revokeTokenPair('acc-jti', 'ref-jti', iat, iat);
      const accCall = bloomMock.bloomAdd.mock.calls.find((c) => c[0] === 'acc-jti')!;
      const expectedTtl = ACCESS_TOKEN_TTL_SECS - 60;
      expect(accCall[1]).toBeCloseTo(expectedTtl, -1);
    });

    it('should keep the refresh token revocation until its remaining lifetime ends when terminating a session', async () => {
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      const iat = NOW_SECS - 3600;
      await revokeTokenPair('acc-jti', 'ref-jti', iat, iat);
      const refCall = bloomMock.bloomAdd.mock.calls.find((c) => c[0] === 'ref-jti')!;
      const expectedTtl = REFRESH_TOKEN_TTL_SECS - 3600;
      expect(refCall[1]).toBeCloseTo(expectedTtl, -2);
    });
  });
});
