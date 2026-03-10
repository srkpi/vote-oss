import * as allure from 'allure-js-commons';

import {
  bloomHitResults,
  bloomMissResults,
  pipelineMock,
  redisMock,
  resetRedisMock,
} from '../helpers/redis-mock';

// ---------------------------------------------------------------------------
// Module mock – must precede the import of bloom
// ---------------------------------------------------------------------------
jest.mock('@/lib/redis', () => ({
  redis: redisMock,
  isRedisReady: jest.fn(() => redisMock.status === 'ready'),
  safeRedis: async <T>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch {
      return null;
    }
  },
}));

import {
  bloomAdd,
  bloomCheck,
  getBloomResetAt,
  invalidateResetAtCache,
  isTokenClean,
  revokedKey,
} from '@/lib/bloom';

const SAMPLE_JTI = 'aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb';
const NOW_MS = Date.now();
const RESET_INTERVAL = 7 * 24 * 60 * 60 * 1_000;

describe('bloom filter', () => {
  beforeEach(() => {
    resetRedisMock();
    invalidateResetAtCache();
    allure.feature('Bloom Filter');
  });

  // ── revokedKey ────────────────────────────────────────────────────────────

  describe('revokedKey', () => {
    it('produces key with revoked: prefix', () => {
      expect(revokedKey(SAMPLE_JTI)).toBe(`revoked:${SAMPLE_JTI}`);
    });
  });

  // ── bloomAdd ─────────────────────────────────────────────────────────────

  describe('bloomAdd', () => {
    beforeEach(() => allure.story('bloomAdd'));

    it('calls pipeline exactly once', async () => {
      await bloomAdd(SAMPLE_JTI, 900);
      expect(redisMock.pipeline).toHaveBeenCalledTimes(1);
    });

    it('sets exactly 7 bits via setbit', async () => {
      await bloomAdd(SAMPLE_JTI, 900);
      expect(pipelineMock.setbit).toHaveBeenCalledTimes(7);
    });

    it('writes the confirmed-revocation key with the given TTL', async () => {
      await bloomAdd(SAMPLE_JTI, 900);
      expect(pipelineMock.set).toHaveBeenCalledWith(revokedKey(SAMPLE_JTI), '1', 'EX', 900);
    });

    it('executes the pipeline once', async () => {
      await bloomAdd(SAMPLE_JTI, 900);
      expect(pipelineMock.exec).toHaveBeenCalledTimes(1);
    });

    it('clamps TTL to 1 second minimum when remaining time is ≤ 0', async () => {
      await bloomAdd(SAMPLE_JTI, 0);
      expect(pipelineMock.set).toHaveBeenCalledWith(
        revokedKey(SAMPLE_JTI),
        '1',
        'EX',
        1, // Math.max(1, 0)
      );
    });

    it('is deterministic: same JTI always sets the same 7 bit positions', async () => {
      await bloomAdd(SAMPLE_JTI, 900);
      const firstCall = pipelineMock.setbit.mock.calls.map((c) => c[1] as number);

      resetRedisMock();
      await bloomAdd(SAMPLE_JTI, 900);
      const secondCall = pipelineMock.setbit.mock.calls.map((c) => c[1] as number);

      expect(firstCall).toEqual(secondCall);
    });

    it('produces different bit positions for different JTIs', async () => {
      await bloomAdd(SAMPLE_JTI, 900);
      const posA = pipelineMock.setbit.mock.calls.map((c) => c[1] as number);

      resetRedisMock();
      await bloomAdd('bbbbbbbb-2222-3333-4444-cccccccccccc', 900);
      const posB = pipelineMock.setbit.mock.calls.map((c) => c[1] as number);

      // All 7 positions must not match exactly (collision would be astronomically rare)
      expect(posA).not.toEqual(posB);
    });

    it('returns silently when Redis throws (safeRedis absorbs the error)', async () => {
      pipelineMock.exec.mockRejectedValueOnce(new Error('Redis connection lost'));
      await expect(bloomAdd(SAMPLE_JTI, 900)).resolves.toBeUndefined();
    });
  });

  // ── bloomCheck ───────────────────────────────────────────────────────────

  describe('bloomCheck', () => {
    beforeEach(() => allure.story('bloomCheck'));

    it('returns "clean" when the first bit is 0 (not in filter)', async () => {
      pipelineMock.exec.mockResolvedValueOnce(bloomMissResults());
      expect(await bloomCheck(SAMPLE_JTI)).toBe('clean');
    });

    it('returns "revoked" when all bits are set AND confirmed key exists', async () => {
      pipelineMock.exec.mockResolvedValueOnce(bloomHitResults(1));
      expect(await bloomCheck(SAMPLE_JTI)).toBe('revoked');
    });

    it('returns "fp" (false positive) when all bits are set but confirmed key is absent', async () => {
      pipelineMock.exec.mockResolvedValueOnce(bloomHitResults(0));
      expect(await bloomCheck(SAMPLE_JTI)).toBe('fp');
    });

    it('returns "error" when pipeline.exec() rejects', async () => {
      pipelineMock.exec.mockRejectedValueOnce(new Error('timeout'));
      expect(await bloomCheck(SAMPLE_JTI)).toBe('error');
    });

    it('returns "error" when pipeline.exec() returns null', async () => {
      pipelineMock.exec.mockResolvedValueOnce(null);
      expect(await bloomCheck(SAMPLE_JTI)).toBe('error');
    });

    it('checks exactly 7 bits + 1 EXISTS in a single pipeline', async () => {
      pipelineMock.exec.mockResolvedValueOnce(bloomMissResults());
      await bloomCheck(SAMPLE_JTI);
      expect(pipelineMock.getbit).toHaveBeenCalledTimes(7);
      expect(pipelineMock.exists).toHaveBeenCalledWith(revokedKey(SAMPLE_JTI));
    });

    it('checks the confirmed key using revokedKey(jti)', async () => {
      pipelineMock.exec.mockResolvedValueOnce(bloomHitResults(1));
      await bloomCheck(SAMPLE_JTI);
      expect(pipelineMock.exists).toHaveBeenCalledWith(`revoked:${SAMPLE_JTI}`);
    });

    it('returns "error" when a getbit result contains an error', async () => {
      // First bit has an error
      const results: [Error | null, number][] = [
        [new Error('bit error'), 0],
        ...Array.from({ length: 6 }, (): [null, number] => [null, 1]),
        [null, 0],
      ];
      pipelineMock.exec.mockResolvedValueOnce(results);
      expect(await bloomCheck(SAMPLE_JTI)).toBe('error');
    });
  });

  // ── getBloomResetAt ───────────────────────────────────────────────────────

  describe('getBloomResetAt', () => {
    beforeEach(() => allure.story('getBloomResetAt'));

    it('returns the timestamp from Redis eval', async () => {
      redisMock.eval.mockResolvedValueOnce(NOW_MS);
      const result = await getBloomResetAt();
      expect(result).toBe(NOW_MS);
    });

    it('calls redis.eval with the bits key, reset_at key, now, and interval', async () => {
      redisMock.eval.mockResolvedValueOnce(NOW_MS);
      await getBloomResetAt();
      const [, , keys, ...args] = redisMock.eval.mock.calls[0] as unknown[];
      expect(keys).toBe(2); // numkeys
      expect(args[0]).toBe('bloom:bits');
      expect(args[1]).toBe('bloom:reset_at');
      expect(Number(args[2])).toBeCloseTo(Date.now(), -2); // within ~100ms
      expect(Number(args[3])).toBe(RESET_INTERVAL);
    });

    it('caches the result and does not hit Redis twice within 60 s', async () => {
      redisMock.eval.mockResolvedValueOnce(NOW_MS);
      await getBloomResetAt(); // first call – hits Redis
      await getBloomResetAt(); // second call – served from cache
      expect(redisMock.eval).toHaveBeenCalledTimes(1);
    });

    it('refreshes the cache after invalidateResetAtCache()', async () => {
      redisMock.eval.mockResolvedValue(NOW_MS);
      await getBloomResetAt();
      invalidateResetAtCache();
      await getBloomResetAt();
      expect(redisMock.eval).toHaveBeenCalledTimes(2);
    });

    it('returns the last cached value (0) when Redis is down', async () => {
      redisMock.eval.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const result = await getBloomResetAt();
      // safeRedis returns null → cache stays 0
      expect(result).toBe(0);
    });
  });

  // ── isTokenClean ──────────────────────────────────────────────────────────

  describe('isTokenClean', () => {
    beforeEach(() => allure.story('isTokenClean'));

    it('returns true when bloomCheck returns "clean"', async () => {
      pipelineMock.exec.mockResolvedValueOnce(bloomMissResults());
      expect(await isTokenClean(SAMPLE_JTI)).toBe(true);
    });

    it('returns true when bloomCheck returns "fp" (false positive = not actually revoked)', async () => {
      pipelineMock.exec.mockResolvedValueOnce(bloomHitResults(0));
      expect(await isTokenClean(SAMPLE_JTI)).toBe(true);
    });

    it('returns false when bloomCheck returns "revoked"', async () => {
      pipelineMock.exec.mockResolvedValueOnce(bloomHitResults(1));
      expect(await isTokenClean(SAMPLE_JTI)).toBe(false);
    });

    it('returns null when bloomCheck returns "error" (Redis unavailable)', async () => {
      pipelineMock.exec.mockRejectedValueOnce(new Error('timeout'));
      expect(await isTokenClean(SAMPLE_JTI)).toBeNull();
    });
  });
});
