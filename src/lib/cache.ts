/**
 * Thin caching layer over Redis.
 *
 * ## Election caching strategy
 *
 * Metadata vs. live counts are separated so that a vote submission does NOT
 * invalidate the entire elections cache — instead it only updates a cheap
 * per-election counter key.  This gives real-time ballot counts without
 * hammering the DB on every vote.
 *
 *   cache:elections                   → full elections metadata (JSON array)
 *   cache:election:count:{id}         → live ballot counter (INCR / SETEX)
 *   cache:user:voted:{userId}         → JSON array of electionIds where user voted
 *
 * The metadata cache is invalidated only on election create / update / delete.
 * The counter expires after CACHE_TTL_ELECTION_VOTE_COUNT_SECS and then falls
 * back to the ballot count embedded in the metadata cache.
 * The user voted-set is invalidated / updated when a vote token is issued.
 *
 * All other caches (admins, FAQ, invite tokens, campus groups) are unchanged.
 */

import {
  CACHE_KEY_ADMINS,
  CACHE_KEY_ELECTIONS,
  CACHE_KEY_FAQ,
  CACHE_KEY_INVITE_TOKENS,
  CACHE_TTL_ADMINS_SECS,
  CACHE_TTL_ELECTION_VOTE_COUNT_SECS,
  CACHE_TTL_ELECTIONS_SECS,
  CACHE_TTL_FAQ_SECS,
  CACHE_TTL_INVITE_TOKENS_SECS,
  CACHE_TTL_USER_VOTED_SECS,
} from '@/lib/constants';
import { redis, safeRedis } from '@/lib/redis';
import type { Admin, CachedInviteToken } from '@/types/admin';
import type { CachedElection } from '@/types/election';
import type { FaqCategoryData } from '@/types/faq';

// ---------------------------------------------------------------------------
// Elections metadata cache
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

/**
 * Invalidate the elections metadata cache.
 * Call on election create / update / delete — NOT on ballot submission.
 * Ballot counts are tracked by the separate per-election counter keys.
 */
export async function invalidateElections(): Promise<void> {
  await safeRedis(() => redis.del(CACHE_KEY_ELECTIONS));
}

// ---------------------------------------------------------------------------
// Per-election real-time ballot counter
// ---------------------------------------------------------------------------

/** Redis key for a specific election's live ballot counter. */
function electionCountKey(electionId: string): string {
  return `cache:election:count:${electionId}`;
}

/**
 * Retrieve the live ballot count for a single election.
 * Returns null when the counter key has expired or Redis is unavailable —
 * in that case callers should fall back to the value in CachedElection.
 */
export async function getLiveElectionBallotCount(electionId: string): Promise<number | null> {
  const raw = await safeRedis(() => redis.get(electionCountKey(electionId)));
  if (raw === null) return null;
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

/**
 * Overwrite the live ballot counter for an election.
 * Used when initialising the counter from a known DB count.
 */
export async function setLiveElectionBallotCount(electionId: string, count: number): Promise<void> {
  await safeRedis(() =>
    redis.set(
      electionCountKey(electionId),
      String(count),
      'EX',
      CACHE_TTL_ELECTION_VOTE_COUNT_SECS,
    ),
  );
}

/**
 * Increment the live ballot counter and return the new value.
 *
 * If the counter key does not exist (expired or never set) INCR will create it
 * at 1, which is almost certainly wrong.  In that case the caller should
 * follow up with a DB count query and overwrite the key via
 * `setLiveElectionBallotCount` — see the ballot submission route.
 *
 * Returns null on Redis errors.
 */
export async function incrementLiveElectionBallotCount(electionId: string): Promise<number | null> {
  const result = await safeRedis(async () => {
    const newCount = await redis.incr(electionCountKey(electionId));
    // Refresh TTL on every increment so busy elections keep the counter alive.
    await redis.expire(electionCountKey(electionId), CACHE_TTL_ELECTION_VOTE_COUNT_SECS);
    return newCount;
  });
  return result;
}

/**
 * Delete the live counter for an election.
 * Called when an election is hard-deleted or when you want to force a re-sync.
 */
export async function invalidateLiveElectionBallotCount(electionId: string): Promise<void> {
  await safeRedis(() => redis.del(electionCountKey(electionId)));
}

/**
 * Overlay live ballot counts onto a cached election array.
 *
 * For each election that has a live counter key the counter value replaces the
 * `ballotCount` in the cached object.  Elections without a live counter keep
 * their cached ballotCount unchanged.
 *
 * Uses a single Redis pipeline so we pay O(1) round trips regardless of how
 * many elections are in the list.
 */
export async function overlayLiveBallotCounts(
  elections: CachedElection[],
): Promise<CachedElection[]> {
  if (elections.length === 0) return elections;

  const results = await safeRedis(async () => {
    const pipeline = redis.pipeline();
    for (const e of elections) {
      pipeline.get(electionCountKey(e.id));
    }
    return pipeline.exec();
  });

  if (!results) return elections; // Redis down — keep cached counts

  return elections.map((election, i) => {
    const [err, raw] = results[i] as [Error | null, string | null];
    if (err || raw === null) return election;
    const live = parseInt(raw, 10);
    if (isNaN(live)) return election;
    return { ...election, ballotCount: live };
  });
}

// ---------------------------------------------------------------------------
// Per-user voted elections cache
// ---------------------------------------------------------------------------

function userVotedKey(userId: string): string {
  return `cache:user:voted:${userId}`;
}

/**
 * Return the set of election IDs where this user has issued a vote token.
 * Returns null on cache miss or Redis error — callers should query IssuedToken.
 */
export async function getCachedUserVotedElections(userId: string): Promise<Set<string> | null> {
  const raw = await safeRedis(() => redis.get(userVotedKey(userId)));
  if (raw === null) return null;
  try {
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return null;
  }
}

/**
 * Persist the set of election IDs where this user has issued a vote token.
 * Pass the full set (not just the delta) as the cache stores the complete list.
 */
export async function setCachedUserVotedElections(
  userId: string,
  electionIds: string[],
): Promise<void> {
  await safeRedis(() =>
    redis.set(userVotedKey(userId), JSON.stringify(electionIds), 'EX', CACHE_TTL_USER_VOTED_SECS),
  );
}

/**
 * Add a single election to the user's voted set without invalidating the whole
 * key — used immediately after a vote token is issued so the elections list
 * reflects the new vote status without a DB round-trip.
 *
 * If the key doesn't exist yet we simply set it with just this election ID;
 * the full set will be populated on the next elections list request.
 */
export async function addToUserVotedElections(userId: string, electionId: string): Promise<void> {
  await safeRedis(async () => {
    const existing = await redis.get(userVotedKey(userId));
    let ids: string[];
    if (existing) {
      try {
        ids = JSON.parse(existing) as string[];
      } catch {
        ids = [];
      }
    } else {
      ids = [];
    }
    if (!ids.includes(electionId)) ids.push(electionId);
    await redis.set(userVotedKey(userId), JSON.stringify(ids), 'EX', CACHE_TTL_USER_VOTED_SECS);
  });
}

/** Invalidate the voted-elections cache for a user (e.g. on logout). */
export async function invalidateUserVotedElections(userId: string): Promise<void> {
  await safeRedis(() => redis.del(userVotedKey(userId)));
}

// ---------------------------------------------------------------------------
// Admin list cache
// ---------------------------------------------------------------------------

/** Return cached admin list, or null if not cached / Redis down. */
export async function getCachedAdmins(): Promise<Admin[] | null> {
  const raw = await safeRedis(() => redis.get(CACHE_KEY_ADMINS));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Admin[];
  } catch {
    return null;
  }
}

/** Store admin list in cache. */
export async function setCachedAdmins(data: Admin[]): Promise<void> {
  await safeRedis(() =>
    redis.set(CACHE_KEY_ADMINS, JSON.stringify(data), 'EX', CACHE_TTL_ADMINS_SECS),
  );
}

/** Invalidate the admin-list cache. */
export async function invalidateAdmins(): Promise<void> {
  await safeRedis(() => redis.del(CACHE_KEY_ADMINS));
}

// ---------------------------------------------------------------------------
// Invite tokens cache
// ---------------------------------------------------------------------------

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
