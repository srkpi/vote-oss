/**
 * Thin caching layer over Redis.
 *
 * • Elections list  – keyed per (faculty, group); 60-second TTL.
 *   Invalidated whenever an admin creates a new election.
 *
 * • Admins list     – single key; 30-second TTL.
 *   Invalidated whenever an admin is created or deleted.
 *
 * All operations are best-effort: if Redis is unavailable the caller falls
 * through to the database.
 */

import type { Admin } from '@prisma/client';

import { redis, safeRedis } from '@/lib/redis';
import type { Election } from '@/types/election';

// ---------------------------------------------------------------------------
// TTLs
// ---------------------------------------------------------------------------

const ELECTIONS_TTL_SECS = 60;
const ADMINS_TTL_SECS = 30;

// ---------------------------------------------------------------------------
// Key builders
// ---------------------------------------------------------------------------

function electionsKey(faculty: string, group: string): string {
  return `cache:elections:${faculty}:${group}`;
}

const ADMINS_KEY = 'cache:admins';

// ---------------------------------------------------------------------------
// Elections
// ---------------------------------------------------------------------------

/** Return cached election list, or null if not cached / Redis down. */
export async function getCachedElections(
  faculty: string,
  group: string,
): Promise<Election[] | null> {
  const raw = await safeRedis(() => redis.get(electionsKey(faculty, group)));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Election[];
  } catch {
    return null;
  }
}

/** Store election list in cache. */
export async function setCachedElections(
  faculty: string,
  group: string,
  data: Election[],
): Promise<void> {
  await safeRedis(() =>
    redis.set(electionsKey(faculty, group), JSON.stringify(data), 'EX', ELECTIONS_TTL_SECS),
  );
}

/**
 * Invalidate ALL election-list cache entries.
 *
 * Because elections are scoped by (faculty, group), we use a SCAN to find and
 * delete all matching keys.  This is safe for moderate keyspaces; in a large
 * deployment consider a tag-based invalidation strategy instead.
 */
export async function invalidateElections(): Promise<void> {
  await safeRedis(async () => {
    const keys = await scanKeys('cache:elections:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });
}

// ---------------------------------------------------------------------------
// Admins
// ---------------------------------------------------------------------------

/** Return cached admin list, or null if not cached / Redis down. */
export async function getCachedAdmins(): Promise<Admin[] | null> {
  const raw = await safeRedis(() => redis.get(ADMINS_KEY));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Admin[];
  } catch {
    return null;
  }
}

/** Store admin list in cache. */
export async function setCachedAdmins(data: Admin[]): Promise<void> {
  await safeRedis(() => redis.set(ADMINS_KEY, JSON.stringify(data), 'EX', ADMINS_TTL_SECS));
}

/** Invalidate the admin-list cache. */
export async function invalidateAdmins(): Promise<void> {
  await safeRedis(() => redis.del(ADMINS_KEY));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Cursor-based SCAN to collect all keys matching a glob pattern.
 * Never blocks the Redis event loop.
 */
async function scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '0';

  do {
    const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== '0');

  return keys;
}
