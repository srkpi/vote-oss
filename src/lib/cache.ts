/**
 * Thin caching layer over Redis.
 *
 * • Elections list     – single global key (unfiltered, status-free); 60-second TTL.
 * • Admins list        – single key; 30-second TTL.
 * • Invite tokens list – single key storing ALL non-deleted tokens; 30-second TTL.
 *   Hierarchy filtering and deletable/isOwn flags are computed in-memory at
 *   serve time, so the cache is shared across all admin callers.
 *
 * All operations are best-effort: if Redis is unavailable the caller falls
 * through to the database.
 */

import {
  CACHE_KEY_ADMINS,
  CACHE_KEY_ELECTIONS,
  CACHE_KEY_INVITE_TOKENS,
  CACHE_TTL_ADMINS_SECS,
  CACHE_TTL_ELECTIONS_SECS,
  CACHE_TTL_INVITE_TOKENS_SECS,
} from '@/lib/constants';
import { redis, safeRedis } from '@/lib/redis';
import type { CachedAdmin, CachedInviteToken } from '@/types/admin';
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

// ---------------------------------------------------------------------------
// Invite tokens
// ---------------------------------------------------------------------------

/**
 * Return cached invite token list, or null if not cached / Redis down.
 * The list contains ALL non-deleted tokens; hierarchy filtering is done
 * in-memory at serve time so the cached value is caller-agnostic.
 */
export async function getCachedInviteTokens(): Promise<CachedInviteToken[] | null> {
  const raw = await safeRedis(() => redis.get(CACHE_KEY_INVITE_TOKENS));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedInviteToken[];
  } catch {
    return null;
  }
}

/** Store all invite tokens in cache. */
export async function setCachedInviteTokens(data: CachedInviteToken[]): Promise<void> {
  await safeRedis(() =>
    redis.set(CACHE_KEY_INVITE_TOKENS, JSON.stringify(data), 'EX', CACHE_TTL_INVITE_TOKENS_SECS),
  );
}

/** Invalidate the invite-token cache (call after any create / delete). */
export async function invalidateInviteTokens(): Promise<void> {
  await safeRedis(() => redis.del(CACHE_KEY_INVITE_TOKENS));
}
