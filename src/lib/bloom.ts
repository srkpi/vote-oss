/**
 * Probabilistic blacklist backed by a Redis bit array.
 *
 * Design
 * ──────
 * • m = 1 000 000 bits  (~125 KB in Redis)
 * • k = 7 hash functions  (Kirsch–Mitzenmacher: g_i = h1 + i·h2 mod m)
 * • h1, h2 derived from the first 8 bytes of SHA-256(jti)
 * • Expected false-positive rate with 50 000 insertions ≈ 0.05 %
 *
 * Periodic reset
 * ──────────────
 * The filter is reset every BLOOM_RESET_INTERVAL_MS (default 7 days,
 * matching the refresh-token lifetime).  The reset timestamp is stored in
 * Redis so every server node sees the same value.
 *
 * Security invariant: any JWT whose `iat` < reset_at is treated as invalid.
 * This means no token issued before the most-recent reset can be replayed,
 * even if it was never explicitly revoked.
 *
 * Confirmed revocations
 * ─────────────────────
 * Because bloom filters have false positives, each deliberate revocation is
 * also written to a Redis key `revoked:{jti}` with a TTL equal to the
 * remaining lifetime of the token.  On a bloom-filter "hit" we do a cheap
 * O(1) EXISTS check on that key to distinguish a real revocation from a
 * false positive.
 */

import { createHash } from 'crypto';

import { redis, safeRedis } from '@/lib/redis';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BLOOM_BITS = 1_000_000;

/** Number of independent hash functions (Kirsch–Mitzenmacher simulated). */
const BLOOM_K = 7;

/** How often the filter is wiped and reset_at updated (matches refresh TTL). */
const BLOOM_RESET_INTERVAL_MS = 7 * 24 * 60 * 60 * 1_000; // 7 days

// ---------------------------------------------------------------------------
// Redis key names
// ---------------------------------------------------------------------------

const KEY_BITS = 'bloom:bits';
const KEY_RESET_AT = 'bloom:reset_at';

/** Per-JTI confirmed-revocation key (with TTL). */
export function revokedKey(jti: string): string {
  return `revoked:${jti}`;
}

// ---------------------------------------------------------------------------
// Hash helpers
// ---------------------------------------------------------------------------

/**
 * Derive k bit-positions for a given item using the Kirsch–Mitzenmacher trick:
 *   h_i(x) = ( h1(x) + i * h2(x) ) mod m
 *
 * h1 and h2 come from the first 8 bytes of SHA-256(x), giving two independent
 * 32-bit unsigned integers.
 */
function bloomPositions(item: string): number[] {
  const digest = createHash('sha256').update(item).digest();

  const h1 = ((digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) | digest[3]) >>> 0;
  const h2 = ((digest[4] << 24) | (digest[5] << 16) | (digest[6] << 8) | digest[7]) >>> 0;

  const positions: number[] = [];
  for (let i = 0; i < BLOOM_K; i++) {
    positions.push(((h1 + i * h2) >>> 0) % BLOOM_BITS);
  }
  return positions;
}

// ---------------------------------------------------------------------------
// Reset management
// ---------------------------------------------------------------------------

// Module-level cache so we avoid a Redis round-trip on every single request.
let _cachedResetAt = 0;
let _cachedResetFetchedAt = 0;
const RESET_AT_CACHE_TTL_MS = 60_000; // re-fetch at most once per minute

/**
 * Returns the current bloom-filter reset timestamp (ms since epoch).
 * Initialises / advances the timestamp in Redis when needed.
 * Falls back to 0 (no reset-time enforcement) if Redis is unavailable.
 */
export async function getBloomResetAt(): Promise<number> {
  const now = Date.now();

  // Return cached value if fresh enough
  if (now - _cachedResetFetchedAt < RESET_AT_CACHE_TTL_MS && _cachedResetAt > 0) {
    return _cachedResetAt;
  }

  const result = await safeRedis(async () => {
    // Lua script: atomically read reset_at, create it if missing,
    // and wipe the bloom bits if the interval has elapsed.
    const luaScript = `
      local bits_key    = KEYS[1]
      local reset_at_key = KEYS[2]
      local now          = tonumber(ARGV[1])
      local interval     = tonumber(ARGV[2])

      local reset_at = tonumber(redis.call('GET', reset_at_key))

      if reset_at == nil then
        -- First ever initialisation
        redis.call('SET', reset_at_key, now)
        redis.call('DEL', bits_key)
        return now
      end

      if (now - reset_at) >= interval then
        -- Interval has elapsed – wipe filter and record new reset time
        redis.call('SET', reset_at_key, now)
        redis.call('DEL', bits_key)
        return now
      end

      return reset_at
    `;

    const raw = await redis.eval(
      luaScript,
      2,
      KEY_BITS,
      KEY_RESET_AT,
      String(now),
      String(BLOOM_RESET_INTERVAL_MS),
    );
    return Number(raw);
  });

  if (result !== null) {
    _cachedResetAt = result;
    _cachedResetFetchedAt = now;
  }

  return _cachedResetAt;
}

/** Force-invalidate the local reset_at cache (call after manual resets in tests). */
export function invalidateResetAtCache(): void {
  _cachedResetAt = 0;
  _cachedResetFetchedAt = 0;
}

// ---------------------------------------------------------------------------
// Core bloom-filter operations
// ---------------------------------------------------------------------------

/**
 * Record `jti` as revoked in the bloom filter.
 *
 * Also writes a per-key confirmation entry (`revoked:{jti}`) with the given
 * TTL so false-positive resolution never needs a DB round-trip.
 *
 * @param jti     JWT ID to blacklist
 * @param ttlSecs Remaining token lifetime in seconds (used for the confirmation key TTL)
 */
export async function bloomAdd(jti: string, ttlSecs: number): Promise<void> {
  await safeRedis(async () => {
    const positions = bloomPositions(jti);
    const pipeline = redis.pipeline();

    for (const pos of positions) {
      pipeline.setbit(KEY_BITS, pos, 1);
    }

    // Confirmed-revocation key: resolves bloom false-positives without DB I/O
    pipeline.set(revokedKey(jti), '1', 'EX', Math.max(1, ttlSecs));

    await pipeline.exec();
  });
}

/**
 * Check whether `jti` is (probably) in the blacklist.
 *
 * Returns:
 *   - `'clean'`    → definitely NOT in blacklist (no DB check needed)
 *   - `'revoked'`  → confirmed revoked (found in the per-key confirmation set)
 *   - `'fp'`       → bloom hit but NOT in confirmation set (false positive)
 *   - `'error'`    → Redis unavailable (caller should fall back to DB)
 */
export async function bloomCheck(jti: string): Promise<'clean' | 'revoked' | 'fp' | 'error'> {
  try {
    const positions = bloomPositions(jti);
    const pipeline = redis.pipeline();

    for (const pos of positions) {
      pipeline.getbit(KEY_BITS, pos);
    }
    // Also check the confirmed-revocation key in the same round-trip
    pipeline.exists(revokedKey(jti));

    const results = await pipeline.exec();
    if (!results) return 'error';

    // Check all bloom bits
    let allSet = true;
    for (let i = 0; i < BLOOM_K; i++) {
      const [err, bit] = results[i] as [Error | null, number];
      if (err) return 'error';
      if (bit === 0) {
        allSet = false;
        break;
      }
    }

    if (!allSet) return 'clean'; // Definitely not in the filter

    // Bloom hit – check the confirmation key
    const [confErr, exists] = results[BLOOM_K] as [Error | null, number];
    if (confErr) return 'error';

    return exists === 1 ? 'revoked' : 'fp';
  } catch (err) {
    console.error('[bloom] check error:', (err as Error).message);
    return 'error';
  }
}

/**
 * Convenience: returns true when `jti` is definitively clean (not revoked).
 * Returns null when Redis is unavailable (caller should fall back to DB).
 */
export async function isTokenClean(jti: string): Promise<boolean | null> {
  const result = await bloomCheck(jti);
  if (result === 'error') return null; // Redis down → caller decides
  return result === 'clean' || result === 'fp'; // fp = not actually revoked
}
