import * as allure from 'allure-js-commons';

import { redisMock, resetRedisMock } from '@/__tests__/helpers/redis-mock';

// ---------------------------------------------------------------------------
// Module mock
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
  getClientIp,
  rateLimit,
  rateLimitInvite,
  rateLimitLogin,
  rateLimitRefresh,
} from '@/lib/rate-limit';

describe('rate-limit', () => {
  beforeEach(() => {
    resetRedisMock();
    delete process.env.TRUSTED_PROXY_COUNT;
    allure.feature('Rate Limiting');
  });

  // ── rateLimit ─────────────────────────────────────────────────────────────

  describe('rateLimit', () => {
    beforeEach(() => allure.story('rateLimit'));

    it('returns limited=false and remaining=limit when Redis is not ready', async () => {
      redisMock.status = 'reconnecting';
      const res = await rateLimit('login', '1.2.3.4', 10, 60_000);
      expect(res.limited).toBe(false);
      expect(res.remaining).toBe(10);
    });

    it('returns limited=false on the first request (count=1)', async () => {
      redisMock.eval.mockResolvedValueOnce([1, 60]); // count=1, ttl=60s
      const res = await rateLimit('login', '1.2.3.4', 10, 60_000);
      expect(res.limited).toBe(false);
      expect(res.remaining).toBe(9); // 10 - 1
      expect(res.resetInMs).toBe(60_000);
    });

    it('returns limited=false when count equals limit exactly', async () => {
      redisMock.eval.mockResolvedValueOnce([10, 30]); // count=10 = limit
      const res = await rateLimit('login', '1.2.3.4', 10, 60_000);
      expect(res.limited).toBe(false);
      expect(res.remaining).toBe(0);
    });

    it('returns limited=true when count exceeds limit', async () => {
      redisMock.eval.mockResolvedValueOnce([11, 25]); // count=11 > limit=10
      const res = await rateLimit('login', '1.2.3.4', 10, 60_000);
      expect(res.limited).toBe(true);
      expect(res.remaining).toBe(0);
    });

    it('uses the TTL from Redis for resetInMs', async () => {
      redisMock.eval.mockResolvedValueOnce([5, 45]);
      const res = await rateLimit('login', '1.2.3.4', 10, 60_000);
      expect(res.resetInMs).toBe(45_000);
    });

    it('falls back to windowMs when TTL is -1 (key has no expiry)', async () => {
      redisMock.eval.mockResolvedValueOnce([1, -1]);
      const res = await rateLimit('login', '1.2.3.4', 10, 60_000);
      expect(res.resetInMs).toBe(60_000);
    });

    it('uses key format rate:{category}:{identifier}', async () => {
      redisMock.eval.mockResolvedValueOnce([1, 60]);
      await rateLimit('mycat', 'myid', 5, 30_000);
      // The key is passed as KEYS[1] = the 3rd argument to eval
      const keyArg = redisMock.eval.mock.calls[0][2] as string;
      expect(keyArg).toBe('rate:mycat:myid');
    });

    it('passes window in seconds (ceiling) as ARGV[1]', async () => {
      redisMock.eval.mockResolvedValueOnce([1, 60]);
      await rateLimit('test', 'id', 5, 61_500); // 61.5s → ceiling = 62
      const windowArg = redisMock.eval.mock.calls[0][3] as string;
      expect(windowArg).toBe('62');
    });

    it('fails open (limited=false) when safeRedis returns null', async () => {
      redisMock.eval.mockRejectedValueOnce(new Error('timeout'));
      const res = await rateLimit('login', '1.2.3.4', 10, 60_000);
      expect(res.limited).toBe(false);
    });
  });

  // ── Pre-configured limiters ───────────────────────────────────────────────

  describe('rateLimitLogin', () => {
    it('uses limit 20 with 60-second window', async () => {
      redisMock.eval.mockResolvedValueOnce([1, 60]);
      await rateLimitLogin('1.2.3.4');
      const keyArg = redisMock.eval.mock.calls[0][2] as string;
      expect(keyArg).toMatch(/^rate:login:/);
      // Verify remaining = 20 - 1 = 19
      const res = await (async () => {
        redisMock.eval.mockResolvedValueOnce([1, 60]);
        return rateLimitLogin('1.2.3.4');
      })();
      expect(res.remaining).toBe(19);
    });
  });

  describe('rateLimitRefresh', () => {
    it('uses limit 30 with 60-second window', async () => {
      redisMock.eval.mockResolvedValueOnce([1, 60]);
      const res = await rateLimitRefresh('1.2.3.4');
      expect(res.remaining).toBe(29); // 30 - 1
    });
  });

  describe('rateLimitInvite', () => {
    it('uses limit 10 with 3600-second window', async () => {
      redisMock.eval.mockResolvedValueOnce([1, 3600]);
      const res = await rateLimitInvite('user-001');
      expect(res.remaining).toBe(9); // 10 - 1
      const keyArg = redisMock.eval.mock.calls[0][2] as string;
      expect(keyArg).toMatch(/^rate:invite:user-001$/);
    });
  });

  // ── getClientIp ───────────────────────────────────────────────────────────

  describe('getClientIp', () => {
    beforeEach(() => allure.story('getClientIp'));

    function makeHeaders(entries: Record<string, string>): Headers {
      const h = new Headers();
      for (const [k, v] of Object.entries(entries)) h.set(k, v);
      return h;
    }

    it('returns the single forwarded IP with one trusted hop (default)', () => {
      const h = makeHeaders({ 'x-forwarded-for': '1.2.3.4' });
      // hops=['1.2.3.4'], trustedHops=1, idx=max(0,1-1)=0 → '1.2.3.4'
      expect(getClientIp(h)).toBe('1.2.3.4');
    });

    it('strips trailing whitespace from each hop', () => {
      const h = makeHeaders({ 'x-forwarded-for': ' 1.2.3.4 , 5.6.7.8 ' });
      // idx=max(0,2-1)=1 → '5.6.7.8'
      expect(getClientIp(h)).toBe('5.6.7.8');
    });

    it('respects TRUSTED_PROXY_COUNT=2 for a two-hop chain', () => {
      const h = makeHeaders({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12' });
      // hops.length=3, trustedHops=2, idx=max(0,3-2)=1 → '5.6.7.8'
      expect(getClientIp(h, 2)).toBe('5.6.7.8');
    });

    it('falls back to x-real-ip when x-forwarded-for is absent', () => {
      const h = makeHeaders({ 'x-real-ip': '10.0.0.1' });
      expect(getClientIp(h)).toBe('10.0.0.1');
    });

    it('returns 0.0.0.0 when no IP headers are present', () => {
      expect(getClientIp(new Headers())).toBe('0.0.0.0');
    });
  });
});
