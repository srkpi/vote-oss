import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, afterEach, it } from 'vitest';

import {
  bloomHitResults,
  bloomMissResults,
  pipelineMock,
  redisMock,
  resetRedisMock,
} from '@/__tests__/helpers/redis-mock';
import { TEST_NOW } from '@/__tests__/helpers/time';

// ---------------------------------------------------------------------------
// Module mock – must precede the import of bloom
// ---------------------------------------------------------------------------
vi.mock('@/lib/redis', async () => {
  const { redisMock } = await import('@/__tests__/helpers/redis-mock');
  return {
    redis: redisMock,
    isRedisReady: vi.fn(() => redisMock.status === 'ready'),
    safeRedis: async <T>(fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch {
        return null;
      }
    },
  };
});

import {
  bloomAdd,
  bloomCheck,
  getBloomResetAt,
  invalidateResetAtCache,
  isTokenClean,
  revokedKey,
} from '@/lib/bloom';

const SAMPLE_JTI = 'aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb';
const NOW_MS = 1_700_000_000_000;
const RESET_INTERVAL = 7 * 24 * 60 * 60 * 1_000;

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetRedisMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Token revocation filter', () => {
  beforeEach(() => {
    invalidateResetAtCache();
    allure.feature('Bloom Filter');
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── revokedKey ────────────────────────────────────────────────────────────

  describe('Identifying a revoked token', () => {
    it('should produce key with revoked: prefix when identifying a revoked token', () => {
      expect(revokedKey(SAMPLE_JTI)).toBe(`revoked:${SAMPLE_JTI}`);
    });
  });

  // ── bloomAdd ─────────────────────────────────────────────────────────────

  describe('Revoking a token', () => {
    beforeEach(() => allure.story('bloomAdd'));

    it('should batch revocation commands together when revoking a token', async () => {
      await bloomAdd(SAMPLE_JTI, 900);
      expect(redisMock.pipeline).toHaveBeenCalledTimes(1);
    });

    it('should set exactly 7 bits via setbit when revoking a token', async () => {
      await bloomAdd(SAMPLE_JTI, 900);
      expect(pipelineMock.setbit).toHaveBeenCalledTimes(7);
    });

    it('should write the confirmed-revocation key with the given TTL when revoking a token', async () => {
      await bloomAdd(SAMPLE_JTI, 900);
      expect(pipelineMock.set).toHaveBeenCalledWith(revokedKey(SAMPLE_JTI), '1', 'EX', 900);
    });

    it('should execute the pipeline once when revoking a token', async () => {
      await bloomAdd(SAMPLE_JTI, 900);
      expect(pipelineMock.exec).toHaveBeenCalledTimes(1);
    });

    it('should clamp TTL to 1 second minimum when remaining time is ≤ 0', async () => {
      await bloomAdd(SAMPLE_JTI, 0);
      expect(pipelineMock.set).toHaveBeenCalledWith(
        revokedKey(SAMPLE_JTI),
        '1',
        'EX',
        1, // Math.max(1, 0)
      );
    });

    it('should set the same seven revocation bits when revoking the same token again', async () => {
      await bloomAdd(SAMPLE_JTI, 900);
      const firstCall = pipelineMock.setbit.mock.calls.map((c) => c[1] as number);

      resetRedisMock();
      await bloomAdd(SAMPLE_JTI, 900);
      const secondCall = pipelineMock.setbit.mock.calls.map((c) => c[1] as number);

      expect(firstCall).toEqual(secondCall);
    });

    it('should produce different bit positions for different JTIs when revoking a token', async () => {
      await bloomAdd(SAMPLE_JTI, 900);
      const posA = pipelineMock.setbit.mock.calls.map((c) => c[1] as number);

      resetRedisMock();
      await bloomAdd('bbbbbbbb-2222-3333-4444-cccccccccccc', 900);
      const posB = pipelineMock.setbit.mock.calls.map((c) => c[1] as number);

      // All 7 positions must not match exactly (collision would be astronomically rare)
      expect(posA).not.toEqual(posB);
    });

    it('should return silently when Redis throws (safeRedis absorbs the error)', async () => {
      pipelineMock.exec.mockRejectedValueOnce(new Error('Redis connection lost'));
      await expect(bloomAdd(SAMPLE_JTI, 900)).resolves.toBeUndefined();
    });
  });

  // ── bloomCheck ───────────────────────────────────────────────────────────

  describe('Checking token revocation', () => {
    beforeEach(() => allure.story('bloomCheck'));

    it('should return "clean" when the first bit is 0 (not in filter)', async () => {
      pipelineMock.exec.mockResolvedValueOnce(bloomMissResults());
      expect(await bloomCheck(SAMPLE_JTI)).toBe('clean');
    });

    it('should return "revoked" when all bits are set AND confirmed key exists', async () => {
      pipelineMock.exec.mockResolvedValueOnce(bloomHitResults(1));
      expect(await bloomCheck(SAMPLE_JTI)).toBe('revoked');
    });

    it('should return "fp" (false positive) when all bits are set but confirmed key is absent', async () => {
      pipelineMock.exec.mockResolvedValueOnce(bloomHitResults(0));
      expect(await bloomCheck(SAMPLE_JTI)).toBe('fp');
    });

    it('should return "error" when pipeline.exec() rejects', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      pipelineMock.exec.mockRejectedValueOnce(new Error('timeout'));
      expect(await bloomCheck(SAMPLE_JTI)).toBe('error');
      spy.mockRestore();
    });

    it('should return "error" when pipeline.exec() returns null', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      pipelineMock.exec.mockResolvedValueOnce(null);
      expect(await bloomCheck(SAMPLE_JTI)).toBe('error');
      spy.mockRestore();
    });

    it('should check exactly 7 bits + 1 EXISTS in a single pipeline when checking token revocation', async () => {
      pipelineMock.exec.mockResolvedValueOnce(bloomMissResults());
      await bloomCheck(SAMPLE_JTI);
      expect(pipelineMock.getbit).toHaveBeenCalledTimes(7);
      expect(pipelineMock.exists).toHaveBeenCalledWith(revokedKey(SAMPLE_JTI));
    });

    it('should check the confirmed key using revokedKey(jti) when checking token revocation', async () => {
      pipelineMock.exec.mockResolvedValueOnce(bloomHitResults(1));
      await bloomCheck(SAMPLE_JTI);
      expect(pipelineMock.exists).toHaveBeenCalledWith(`revoked:${SAMPLE_JTI}`);
    });

    it('should return "error" when a getbit result contains an error', async () => {
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

  describe('Reading the revocation filter reset time', () => {
    beforeEach(() => allure.story('getBloomResetAt'));

    it('should return the timestamp from Redis eval when reading the revocation filter reset time', async () => {
      redisMock.eval.mockResolvedValueOnce(NOW_MS);
      const result = await getBloomResetAt();
      expect(result).toBe(NOW_MS);
    });

    it('should supply the filter keys and reset schedule when synchronizing revocation state', async () => {
      redisMock.eval.mockResolvedValueOnce(NOW_MS);
      await getBloomResetAt();
      const [, keys, ...args] = redisMock.eval.mock.calls[0] as unknown[];
      expect(keys).toBe(2); // numkeys
      expect(args[0]).toBe('bloom:bits');
      expect(args[1]).toBe('bloom:reset_at');
      expect(Number(args[2])).toBeCloseTo(NOW_MS, -2); // within ~100ms
      expect(Number(args[3])).toBe(RESET_INTERVAL);
    });

    it('should reuse the cached reset time when it is requested again within 60 seconds', async () => {
      redisMock.eval.mockResolvedValueOnce(NOW_MS);
      await getBloomResetAt(); // first call – hits Redis
      await getBloomResetAt(); // second call – served from cache
      expect(redisMock.eval).toHaveBeenCalledTimes(1);
    });

    it('should refresh the cache after invalidateResetAtCache()', async () => {
      redisMock.eval.mockResolvedValue(NOW_MS);
      await getBloomResetAt();
      invalidateResetAtCache();
      await getBloomResetAt();
      expect(redisMock.eval).toHaveBeenCalledTimes(2);
    });

    it('should return the last cached value (0) when Redis is down', async () => {
      redisMock.eval.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const result = await getBloomResetAt();
      // safeRedis returns null → cache stays 0
      expect(result).toBe(0);
    });
  });

  // ── isTokenClean ──────────────────────────────────────────────────────────

  describe('Checking whether a token is revoked', () => {
    beforeEach(() => allure.story('isTokenClean'));

    it('should return true when bloomCheck returns "clean"', async () => {
      pipelineMock.exec.mockResolvedValueOnce(bloomMissResults());
      expect(await isTokenClean(SAMPLE_JTI)).toBe(true);
    });

    it('should return true when bloomCheck returns "fp" (false positive = not actually revoked)', async () => {
      pipelineMock.exec.mockResolvedValueOnce(bloomHitResults(0));
      expect(await isTokenClean(SAMPLE_JTI)).toBe(true);
    });

    it('should return false when bloomCheck returns "revoked"', async () => {
      pipelineMock.exec.mockResolvedValueOnce(bloomHitResults(1));
      expect(await isTokenClean(SAMPLE_JTI)).toBe(false);
    });

    it('should return null when bloomCheck returns "error" (Redis unavailable)', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      pipelineMock.exec.mockRejectedValueOnce(new Error('timeout'));
      expect(await isTokenClean(SAMPLE_JTI)).toBeNull();
      spy.mockRestore();
    });
  });
});
