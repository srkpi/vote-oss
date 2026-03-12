/**
 * Thin caching layer over Redis.
 *
 * • Elections list  – single global key (unfiltered, status-free); 60-second TTL.
 *   Faculty/group filtering and status computation happen at read time so the
 *   cache never goes stale on status transitions (upcoming → open → closed).
 *   Invalidated whenever an admin creates a new election.
 *
 * • Admins list     – single key; 30-second TTL.
 *   Invalidated whenever an admin is created or deleted.
 *
 * All operations are best-effort: if Redis is unavailable the caller falls
 * through to the database.
 */

import {
  CACHE_KEY_ADMINS,
  CACHE_KEY_ELECTIONS,
  CACHE_TTL_ADMINS_SECS,
  CACHE_TTL_ELECTIONS_SECS,
} from '@/lib/constants';
import { redis, safeRedis } from '@/lib/redis';
import type { CachedAdmin } from '@/types/admin';
import type { Election } from '@/types/election';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Shape stored in Redis for each election.
 *
 * `status` is intentionally absent – it is derived from `opensAt`/`closesAt`
 * at serve time so cached entries never return a stale status.
 *
 * `privateKey` is always stored so we can expose it once the election closes
 * without a cache miss, but route handlers must strip it for open elections.
 */
export type CachedElection = Omit<Election, 'status'> & {
  privateKey: string; // always present in cache; conditionally exposed to clients
};

// ---------------------------------------------------------------------------
// Elections
// ---------------------------------------------------------------------------

/** Return cached elections, or null if not cached / Redis down. */
export async function getCachedElections(): Promise<CachedElection[] | null> {
  const raw = await safeRedis(() => redis.get(CACHE_KEY_ELECTIONS));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedElection[];
  } catch {
    return null;
  }
}

/** Store the full (unfiltered, status-free) election list in cache. */
export async function setCachedElections(data: CachedElection[]): Promise<void> {
  await safeRedis(() =>
    redis.set(CACHE_KEY_ELECTIONS, JSON.stringify(data), 'EX', CACHE_TTL_ELECTIONS_SECS),
  );
}

/** Invalidate the election-list cache. */
export async function invalidateElections(): Promise<void> {
  await safeRedis(() => redis.del(CACHE_KEY_ELECTIONS));
}

// ---------------------------------------------------------------------------
// Admins
// ---------------------------------------------------------------------------

/** Return cached admin list, or null if not cached / Redis down. */
export async function getCachedAdmins(): Promise<CachedAdmin[] | null> {
  const raw = await safeRedis(() => redis.get(CACHE_KEY_ADMINS));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedAdmin[];
  } catch {
    return null;
  }
}

/** Store admin list in cache. */
export async function setCachedAdmins(data: CachedAdmin[]): Promise<void> {
  await safeRedis(() =>
    redis.set(CACHE_KEY_ADMINS, JSON.stringify(data), 'EX', CACHE_TTL_ADMINS_SECS),
  );
}

/** Invalidate the admin-list cache. */
export async function invalidateAdmins(): Promise<void> {
  await safeRedis(() => redis.del(CACHE_KEY_ADMINS));
}
