/**
 * Fixed-window rate limiter backed by Redis.
 *
 * Usage
 * ─────
 *   const limited = await rateLimit('login', ip, 10, 60_000);
 *   if (limited) return Errors.tooManyRequests();
 *
 * Key format: `rate:{category}:{identifier}`
 * Window resets when the key TTL expires (first request in each window sets
 * the TTL; subsequent requests only increment the counter).
 */

import { redis, safeRedis } from '@/lib/redis';

interface RateLimitResult {
  limited: boolean;
  remaining: number;
  resetInMs: number;
}

/**
 * Increment the request counter for the given category + identifier.
 *
 * @param category   Logical bucket name, e.g. `'login'`, `'api'`
 * @param identifier IP address, user ID, or any other throttle key
 * @param limit      Maximum requests allowed per window
 * @param windowMs   Window duration in milliseconds
 *
 * Returns `{ limited: false }` when Redis is unavailable (fail-open to avoid
 * blocking legitimate traffic during a Redis outage).
 */
export async function rateLimit(
  category: string,
  identifier: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (redis.status !== 'ready') {
    // Fail-open during Redis outage
    return { limited: false, remaining: limit, resetInMs: windowMs };
  }

  const key = `rate:${category}:${identifier}`;
  const windowSecs = Math.ceil(windowMs / 1_000);

  const result = await safeRedis(async () => {
    // Lua script: INCR + conditional EXPIRE (atomically sets TTL only on the
    // first request in a window so the window doesn't keep sliding).
    const script = `
      local count = redis.call('INCR', KEYS[1])
      if count == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
      end
      local ttl = redis.call('TTL', KEYS[1])
      return {count, ttl}
    `;
    return redis.eval(script, 1, key, String(windowSecs)) as Promise<[number, number]>;
  });

  if (!result) {
    return { limited: false, remaining: limit, resetInMs: windowMs };
  }

  const [count, ttl] = result;
  const remaining = Math.max(0, limit - count);
  const resetInMs = ttl > 0 ? ttl * 1_000 : windowMs;

  return {
    limited: count > limit,
    remaining,
    resetInMs,
  };
}

// Pre-configured limiters for common endpoints
/** Login via KPI ID ticket: 20 attempts per IP per minute. */
export async function rateLimitLogin(ip: string): Promise<RateLimitResult> {
  return rateLimit('login', ip, 20, 60_000);
}

/** Token refresh: 30 calls per IP per minute (handles tab storms). */
export async function rateLimitRefresh(ip: string): Promise<RateLimitResult> {
  return rateLimit('refresh', ip, 30, 60_000);
}

/** Admin invite-token creation: 10 per admin per hour. */
export async function rateLimitInvite(userId: string): Promise<RateLimitResult> {
  return rateLimit('invite', userId, 10, 60 * 60_000);
}

/**
 * Best-effort IP extraction.  In production behind a proxy / CDN,
 * set the `TRUSTED_PROXY_COUNT` env var to the number of proxy hops so
 * we don't trust spoofed `x-forwarded-for` values.
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const hops = xff.split(',').map((h) => h.trim());
    const trustedHops = parseInt(process.env.TRUSTED_PROXY_COUNT ?? '1', 10);
    const idx = Math.max(0, hops.length - trustedHops);
    return hops[idx] ?? '0.0.0.0';
  }
  return headers.get('x-real-ip') ?? '0.0.0.0';
}
