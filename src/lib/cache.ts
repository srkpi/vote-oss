/**
 * Thin caching layer over Redis.
 *
 * • Elections list     – single global key (unfiltered, status-free);
 * • Admins list        – single key;
 * • Invite tokens list – single key storing ALL non-deleted tokens;
 *   Hierarchy filtering and deletable/isOwn flags are computed in-memory at
 *   serve time, so the cache is shared across all admin callers.
 * • FAQ categories     – single key storing all categories with nested items,
 *   ordered by position; invalidated on any mutation.
 *
 * All operations are best-effort: if Redis is unavailable the caller falls
 * through to the database.
 */

import {
  CACHE_KEY_ADMINS,
  CACHE_KEY_ELECTIONS,
  CACHE_KEY_FAQ,
  CACHE_KEY_INVITE_TOKENS,
  CACHE_TTL_ADMINS_SECS,
  CACHE_TTL_ELECTIONS_SECS,
  CACHE_TTL_FAQ_SECS,
  CACHE_TTL_INVITE_TOKENS_SECS,
} from '@/lib/constants';
import { redis, safeRedis } from '@/lib/redis';
import type { CachedAdmin, CachedInviteToken } from '@/types/admin';
import type { Election } from '@/types/election';
import type { FaqCategoryData } from '@/types/faq';

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

// ---------------------------------------------------------------------------
// FAQ cache
// ---------------------------------------------------------------------------

/**
 * Return the cached FAQ category list (with nested items), or null on a
 * cache miss / Redis unavailability.
 */
export async function getCachedFaq(): Promise<FaqCategoryData[] | null> {
  const raw = await safeRedis(() => redis.get(CACHE_KEY_FAQ));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FaqCategoryData[];
  } catch {
    return null;
  }
}

/**
 * Store the full FAQ category list (categories + nested items, ordered by
 * position) in Redis with a TTL of CACHE_TTL_FAQ_SECS (5 minutes).
 */
export async function setCachedFaq(data: FaqCategoryData[]): Promise<void> {
  await safeRedis(() => redis.set(CACHE_KEY_FAQ, JSON.stringify(data), 'EX', CACHE_TTL_FAQ_SECS));
}

/**
 * Invalidate the FAQ cache.
 * Call this after any mutation: create/update/delete category or item,
 * and after reordering categories or items.
 */
export async function invalidateFaq(): Promise<void> {
  await safeRedis(() => redis.del(CACHE_KEY_FAQ));
}
