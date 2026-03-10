import * as allure from 'allure-js-commons';

import { JWT_TOKEN_RECORD } from '../helpers/fixtures';
import { prismaMock, resetPrismaMock } from '../helpers/prisma-mock';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const bloomMock = {
  bloomAdd: jest.fn<Promise<void>, [string, number]>().mockResolvedValue(undefined),
  getBloomResetAt: jest.fn<Promise<number>, []>().mockResolvedValue(0),
  isTokenClean: jest.fn<Promise<boolean | null>, [string]>().mockResolvedValue(true),
  revokedKey: jest.fn((jti: string) => `revoked:${jti}`),
};

jest.mock('@/lib/bloom', () => bloomMock);
jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
// safeRedis is only used in invalidateAdminCache (dynamic import); stub it out
jest.mock('@/lib/redis', () => ({
  redis: {},
  isRedisReady: jest.fn(() => true),
  safeRedis: jest.fn(async (fn: () => Promise<unknown>) => {
    try {
      return await fn();
    } catch {
      return null;
    }
  }),
}));
// Dynamic import of @/lib/cache inside invalidateAdminCache
jest.mock('@/lib/cache', () => ({
  invalidateAdmins: jest.fn().mockResolvedValue(undefined),
}));

import {
  ACCESS_TTL_SECS,
  isAccessTokenValid,
  isRefreshTokenValid,
  persistTokenPair,
  REFRESH_TTL_SECS,
  revokeByAccessJti,
  revokeByRefreshJti,
  revokeTokenPair,
} from '@/lib/token-store';

const NOW_SECS = Math.floor(Date.now() / 1_000);
// iat 5 seconds ago (well within access token lifetime)
const RECENT_IAT = NOW_SECS - 5;

describe('token-store', () => {
  beforeEach(() => {
    resetPrismaMock();
    bloomMock.bloomAdd.mockReset().mockResolvedValue(undefined);
    bloomMock.getBloomResetAt.mockReset().mockResolvedValue(0); // 0 = no reset gate
    bloomMock.isTokenClean.mockReset().mockResolvedValue(true); // default: clean
    allure.feature('Token Store');
  });

  // ── persistTokenPair ──────────────────────────────────────────────────────

  describe('persistTokenPair', () => {
    beforeEach(() => allure.story('persistTokenPair'));

    it('creates a jwtToken DB record with the given JTIs', async () => {
      prismaMock.jwtToken.create.mockResolvedValueOnce({});
      await persistTokenPair('access-jti', 'refresh-jti');
      expect(prismaMock.jwtToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          access_jti: 'access-jti',
          refresh_jti: 'refresh-jti',
        }),
      });
    });

    it('includes created_at timestamp', async () => {
      prismaMock.jwtToken.create.mockResolvedValueOnce({});
      await persistTokenPair('a', 'b');
      const { data } = prismaMock.jwtToken.create.mock.calls[0][0];
      expect(data.created_at).toBeInstanceOf(Date);
    });
  });

  // ── isAccessTokenValid ────────────────────────────────────────────────────

  describe('isAccessTokenValid', () => {
    beforeEach(() => allure.story('isAccessTokenValid'));

    it('returns false when iat is before the bloom reset timestamp', async () => {
      const resetAt = Date.now(); // now in ms
      bloomMock.getBloomResetAt.mockResolvedValueOnce(resetAt);
      // iat = 10s ago, resetAt = now → token predates reset
      const oldIat = NOW_SECS - 10;
      expect(await isAccessTokenValid('jti', oldIat)).toBe(false);
    });

    it('does NOT reject when iat is after the bloom reset', async () => {
      const pastResetAt = Date.now() - 10_000; // 10s ago
      bloomMock.getBloomResetAt.mockResolvedValueOnce(pastResetAt);
      bloomMock.isTokenClean.mockResolvedValueOnce(true);
      expect(await isAccessTokenValid('jti', NOW_SECS)).toBe(true);
    });

    it('returns true immediately when bloom says CLEAN (no DB call)', async () => {
      bloomMock.isTokenClean.mockResolvedValueOnce(true);
      expect(await isAccessTokenValid('jti', RECENT_IAT)).toBe(true);
      expect(prismaMock.jwtToken.findFirst).not.toHaveBeenCalled();
    });

    it('returns false immediately when bloom says REVOKED (no DB call)', async () => {
      bloomMock.isTokenClean.mockResolvedValueOnce(false);
      expect(await isAccessTokenValid('jti', RECENT_IAT)).toBe(false);
      expect(prismaMock.jwtToken.findFirst).not.toHaveBeenCalled();
    });

    it('falls back to DB when bloom returns null (Redis unavailable) and record exists', async () => {
      bloomMock.isTokenClean.mockResolvedValueOnce(null);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce({ access_jti: 'jti' });
      expect(await isAccessTokenValid('jti', RECENT_IAT)).toBe(true);
    });

    it('falls back to DB when bloom returns null and record is absent → returns false', async () => {
      bloomMock.isTokenClean.mockResolvedValueOnce(null);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(null);
      expect(await isAccessTokenValid('jti', RECENT_IAT)).toBe(false);
    });

    it('queries DB with the correct access_jti on fallback', async () => {
      bloomMock.isTokenClean.mockResolvedValueOnce(null);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(JWT_TOKEN_RECORD);
      await isAccessTokenValid('my-jti', RECENT_IAT);
      expect(prismaMock.jwtToken.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { access_jti: 'my-jti' } }),
      );
    });

    it('skips the reset-time gate when resetAt is 0 (disabled)', async () => {
      bloomMock.getBloomResetAt.mockResolvedValueOnce(0);
      bloomMock.isTokenClean.mockResolvedValueOnce(true);
      // Very old iat but resetAt=0 → gate is off → should still pass
      expect(await isAccessTokenValid('jti', 1_000)).toBe(true);
    });
  });

  // ── isRefreshTokenValid ───────────────────────────────────────────────────

  describe('isRefreshTokenValid', () => {
    beforeEach(() => allure.story('isRefreshTokenValid'));

    it('returns false when iat predates the bloom reset', async () => {
      bloomMock.getBloomResetAt.mockResolvedValueOnce(Date.now());
      expect(await isRefreshTokenValid('jti', NOW_SECS - 10)).toBe(false);
    });

    it('returns true from bloom fast-path', async () => {
      bloomMock.isTokenClean.mockResolvedValueOnce(true);
      expect(await isRefreshTokenValid('jti', RECENT_IAT)).toBe(true);
      expect(prismaMock.jwtToken.findFirst).not.toHaveBeenCalled();
    });

    it('falls back to DB with refresh_jti selector', async () => {
      bloomMock.isTokenClean.mockResolvedValueOnce(null);
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce({ refresh_jti: 'jti' });
      await isRefreshTokenValid('jti', RECENT_IAT);
      expect(prismaMock.jwtToken.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { refresh_jti: 'jti' } }),
      );
    });
  });

  // ── revokeByAccessJti ─────────────────────────────────────────────────────

  describe('revokeByAccessJti', () => {
    beforeEach(() => allure.story('revokeByAccessJti'));

    it('bloom-adds the access JTI immediately', async () => {
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(null);
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      await revokeByAccessJti('access-jti', NOW_SECS - 5);
      expect(bloomMock.bloomAdd).toHaveBeenCalledWith('access-jti', expect.any(Number));
    });

    it('deletes the DB record by access_jti', async () => {
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(null);
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      await revokeByAccessJti('access-jti', NOW_SECS - 5);
      expect(prismaMock.jwtToken.deleteMany).toHaveBeenCalledWith({
        where: { access_jti: 'access-jti' },
      });
    });

    it('also bloom-adds the sibling refresh JTI when the DB record is found', async () => {
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce({
        refresh_jti: 'refresh-jti',
        created_at: new Date(Date.now() - 5_000),
      });
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      await revokeByAccessJti('access-jti', NOW_SECS - 5);

      const calls = bloomMock.bloomAdd.mock.calls.map((c) => c[0]);
      expect(calls).toContain('refresh-jti');
    });

    it('skips refresh bloom-add when no sibling record is found', async () => {
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(null);
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 0 });
      await revokeByAccessJti('access-jti', NOW_SECS - 5);
      // Only the access token itself should be bloom-added
      expect(bloomMock.bloomAdd).toHaveBeenCalledTimes(1);
    });

    it('clamps TTL to minimum 1 when token has already expired', async () => {
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(null);
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 0 });
      // iat far in the past
      await revokeByAccessJti('access-jti', 1_000);
      const ttl = bloomMock.bloomAdd.mock.calls[0][1] as number;
      expect(ttl).toBeGreaterThanOrEqual(1);
    });
  });

  // ── revokeByRefreshJti ────────────────────────────────────────────────────

  describe('revokeByRefreshJti', () => {
    beforeEach(() => allure.story('revokeByRefreshJti'));

    it('looks up the sibling access JTI from DB', async () => {
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce({ access_jti: 'access-jti' });
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      await revokeByRefreshJti('refresh-jti', RECENT_IAT);
      expect(prismaMock.jwtToken.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { refresh_jti: 'refresh-jti' } }),
      );
    });

    it('bloom-adds the refresh JTI', async () => {
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(null);
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      await revokeByRefreshJti('refresh-jti', RECENT_IAT);
      expect(bloomMock.bloomAdd).toHaveBeenCalledWith('refresh-jti', expect.any(Number));
    });

    it('bloom-adds the sibling access JTI when found', async () => {
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce({ access_jti: 'access-jti' });
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      await revokeByRefreshJti('refresh-jti', RECENT_IAT);
      const addedJtis = bloomMock.bloomAdd.mock.calls.map((c) => c[0]);
      expect(addedJtis).toContain('access-jti');
    });

    it('returns the sibling access JTI', async () => {
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce({ access_jti: 'access-jti' });
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      const result = await revokeByRefreshJti('refresh-jti', RECENT_IAT);
      expect(result.accessJti).toBe('access-jti');
    });

    it('returns null accessJti when no DB record is found', async () => {
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(null);
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 0 });
      const result = await revokeByRefreshJti('refresh-jti', RECENT_IAT);
      expect(result.accessJti).toBeNull();
    });

    it('deletes the DB record by refresh_jti', async () => {
      prismaMock.jwtToken.findFirst.mockResolvedValueOnce(null);
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      await revokeByRefreshJti('refresh-jti', RECENT_IAT);
      expect(prismaMock.jwtToken.deleteMany).toHaveBeenCalledWith({
        where: { refresh_jti: 'refresh-jti' },
      });
    });
  });

  // ── revokeTokenPair ───────────────────────────────────────────────────────

  describe('revokeTokenPair', () => {
    beforeEach(() => allure.story('revokeTokenPair'));

    it('bloom-adds both access and refresh JTIs', async () => {
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      await revokeTokenPair('acc-jti', 'ref-jti', RECENT_IAT, RECENT_IAT);
      const addedJtis = bloomMock.bloomAdd.mock.calls.map((c) => c[0]);
      expect(addedJtis).toContain('acc-jti');
      expect(addedJtis).toContain('ref-jti');
    });

    it('deletes the DB record by access_jti', async () => {
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      await revokeTokenPair('acc-jti', 'ref-jti', RECENT_IAT, RECENT_IAT);
      expect(prismaMock.jwtToken.deleteMany).toHaveBeenCalledWith({
        where: { access_jti: 'acc-jti' },
      });
    });

    it('computes access TTL correctly', async () => {
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      const iat = NOW_SECS - 60; // 60 seconds ago
      await revokeTokenPair('acc-jti', 'ref-jti', iat, iat);
      const accCall = bloomMock.bloomAdd.mock.calls.find((c) => c[0] === 'acc-jti')!;
      const expectedTtl = ACCESS_TTL_SECS - 60;
      expect(accCall[1]).toBeCloseTo(expectedTtl, -1);
    });

    it('computes refresh TTL correctly', async () => {
      prismaMock.jwtToken.deleteMany.mockResolvedValueOnce({ count: 1 });
      const iat = NOW_SECS - 3600;
      await revokeTokenPair('acc-jti', 'ref-jti', iat, iat);
      const refCall = bloomMock.bloomAdd.mock.calls.find((c) => c[0] === 'ref-jti')!;
      const expectedTtl = REFRESH_TTL_SECS - 3600;
      expect(refCall[1]).toBeCloseTo(expectedTtl, -2);
    });
  });
});
