import * as allure from 'allure-js-commons';
import { vi, describe, expect, beforeEach, it, afterEach } from 'vitest';

import { redisMock, resetRedisMock } from '@/__tests__/helpers/redis-mock';
import { TEST_NOW } from '@/__tests__/helpers/time';

// ---------------------------------------------------------------------------
// Module mock
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

import { getClientIp, rateLimit } from '@/lib/rate-limit';

beforeEach(() => {
  vi.setSystemTime(TEST_NOW);
  resetRedisMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Request limits and trusted proxies', () => {
  beforeEach(() => {
    delete process.env.TRUSTED_PROXY_COUNT;
    allure.feature('Rate Limiting');
  });

  // ── rateLimit ─────────────────────────────────────────────────────────────

  describe('Checking the request limit', () => {
    beforeEach(() => allure.story('rateLimit'));

    it('should return limited=false and remaining=limit when Redis is not ready', async () => {
      redisMock.status = 'reconnecting';
      const res = await rateLimit('login', '1.2.3.4', 10, 60_000);
      expect(res.limited).toBe(false);
      expect(res.remaining).toBe(10);
    });

    it('should return limited=false on the first request (count=1) when checking the request limit', async () => {
      redisMock.eval.mockResolvedValueOnce([1, 60]); // count=1, ttl=60s
      const res = await rateLimit('login', '1.2.3.4', 10, 60_000);
      expect(res.limited).toBe(false);
      expect(res.remaining).toBe(9); // 10 - 1
      expect(res.resetInMs).toBe(60_000);
    });

    it('should return limited=false when count equals limit exactly', async () => {
      redisMock.eval.mockResolvedValueOnce([10, 30]); // count=10 = limit
      const res = await rateLimit('login', '1.2.3.4', 10, 60_000);
      expect(res.limited).toBe(false);
      expect(res.remaining).toBe(0);
    });

    it('should return limited=true when count exceeds limit', async () => {
      redisMock.eval.mockResolvedValueOnce([11, 25]); // count=11 > limit=10
      const res = await rateLimit('login', '1.2.3.4', 10, 60_000);
      expect(res.limited).toBe(true);
      expect(res.remaining).toBe(0);
    });

    it('should use the TTL from Redis for resetInMs when checking the request limit', async () => {
      redisMock.eval.mockResolvedValueOnce([5, 45]);
      const res = await rateLimit('login', '1.2.3.4', 10, 60_000);
      expect(res.resetInMs).toBe(45_000);
    });

    it('should fall back to windowMs when TTL is -1 (key has no expiry)', async () => {
      redisMock.eval.mockResolvedValueOnce([1, -1]);
      const res = await rateLimit('login', '1.2.3.4', 10, 60_000);
      expect(res.resetInMs).toBe(60_000);
    });

    it('should use key format rate:{category}:{identifier} when checking the request limit', async () => {
      redisMock.eval.mockResolvedValueOnce([1, 60]);
      await rateLimit('mycat', 'myid', 5, 30_000);
      // The key is passed as KEYS[1] = the 3rd argument to eval
      const keyArg = redisMock.eval.mock.calls[0][2] as string;
      expect(keyArg).toBe('rate:mycat:myid');
    });

    it('should pass window in seconds (ceiling) as ARGV[1] when checking the request limit', async () => {
      redisMock.eval.mockResolvedValueOnce([1, 60]);
      await rateLimit('test', 'id', 5, 61_500); // 61.5s → ceiling = 62
      const windowArg = redisMock.eval.mock.calls[0][3] as string;
      expect(windowArg).toBe('62');
    });

    it('should allow the request when the rate-limit store is unavailable', async () => {
      redisMock.eval.mockRejectedValueOnce(new Error('timeout'));
      const res = await rateLimit('login', '1.2.3.4', 10, 60_000);
      expect(res.limited).toBe(false);
    });
  });

  // ── getClientIp ───────────────────────────────────────────────────────────

  describe('Identifying the request origin', () => {
    beforeEach(() => allure.story('getClientIp'));

    function makeHeaders(entries: Record<string, string>): Headers {
      const h = new Headers();
      for (const [k, v] of Object.entries(entries)) {
        h.set(k, v);
      }
      return h;
    }

    it('should return the single forwarded IP with one trusted hop (default) when identifying the request origin', () => {
      const h = makeHeaders({ 'x-forwarded-for': '1.2.3.4' });
      // hops=['1.2.3.4'], trustedHops=1, idx=max(0,1-1)=0 → '1.2.3.4'
      expect(getClientIp(h)).toBe('1.2.3.4');
    });

    it('should strip trailing whitespace from each hop when identifying the request origin', () => {
      const h = makeHeaders({ 'x-forwarded-for': ' 1.2.3.4 , 5.6.7.8 ' });
      // idx=max(0,2-1)=1 → '5.6.7.8'
      expect(getClientIp(h)).toBe('5.6.7.8');
    });

    it('should respect TRUSTED_PROXY_COUNT=2 for a two-hop chain when identifying the request origin', () => {
      const h = makeHeaders({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12' });
      // hops.length=3, trustedHops=2, idx=max(0,3-2)=1 → '5.6.7.8'
      expect(getClientIp(h, 2)).toBe('5.6.7.8');
    });

    it('should fall back to x-real-ip when x-forwarded-for is absent', () => {
      const h = makeHeaders({ 'x-real-ip': '10.0.0.1' });
      expect(getClientIp(h)).toBe('10.0.0.1');
    });

    it('should return 0.0.0.0 when no IP headers are present', () => {
      expect(getClientIp(new Headers())).toBe('0.0.0.0');
    });
  });
});
