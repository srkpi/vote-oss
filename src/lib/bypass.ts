/**
 * Bypass token business logic.
 *
 * Cache structure
 * ───────────────
 * Key:   `cache:bypass:user:{userId}`
 * Value: serialised UserBypassInfo
 * TTL:   CACHE_TTL_BYPASS_SECS (5 min)
 *
 * The cache is invalidated whenever a bypass usage for the user is created
 * or revoked. Expiry is enforced at read-time by checking `validUntil`.
 */

import { CACHE_TTL_BYPASS_SECS } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { redis, safeRedis } from '@/lib/redis';
import type { ElectionBypassInfo, GlobalBypassInfo, UserBypassInfo } from '@/types/bypass';

function bypassCacheKey(userId: string): string {
  return `cache:bypass:user:${userId}`;
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

async function getCachedBypass(userId: string): Promise<UserBypassInfo | null> {
  const raw = await safeRedis(() => redis.get(bypassCacheKey(userId)));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserBypassInfo;
  } catch {
    return null;
  }
}

async function setCachedBypass(userId: string, info: UserBypassInfo): Promise<void> {
  await safeRedis(() =>
    redis.set(bypassCacheKey(userId), JSON.stringify(info), 'EX', CACHE_TTL_BYPASS_SECS),
  );
}

export async function invalidateUserBypassCache(userId: string): Promise<void> {
  await safeRedis(() => redis.del(bypassCacheKey(userId)));
}

// ---------------------------------------------------------------------------
// Core lookup
// ---------------------------------------------------------------------------

/**
 * Return all active (non-revoked, non-expired) bypass info for a user.
 * Results are served from Redis when cached.
 */
export async function getUserBypassInfo(userId: string): Promise<UserBypassInfo> {
  const cached = await getCachedBypass(userId);
  if (cached) {
    // Prune expired entries so the caller doesn't act on stale data
    const now = Date.now();
    const global = cached.global && cached.global.validUntil > now ? cached.global : null;
    const elections: Record<string, ElectionBypassInfo> = {};
    for (const [electionId, info] of Object.entries(cached.elections)) {
      if (info.validUntil > now) elections[electionId] = info;
    }
    return { global, elections };
  }

  const now = new Date();

  // Fetch all active usages for this user in a single query
  const usages = await prisma.bypassTokenUsage.findMany({
    where: {
      user_id: userId,
      revoked_at: null,
      token: { valid_until: { gt: now } },
    },
    include: {
      token: {
        select: {
          type: true,
          election_id: true,
          bypass_not_studying: true,
          bypass_restrictions: true,
          valid_until: true,
        },
      },
    },
  });

  let global: GlobalBypassInfo | null = null;
  const elections: Record<string, ElectionBypassInfo> = {};

  for (const usage of usages) {
    const { token } = usage;
    const validUntil = token.valid_until.getTime();

    if (token.type === 'GLOBAL') {
      // Last-write-wins if multiple (shouldn't happen in practice)
      global = {
        bypassNotStudying: token.bypass_not_studying,
        validUntil,
      };
    } else if (token.type === 'ELECTION' && token.election_id) {
      // Multiple election bypasses: merge bypassedTypes (union)
      const existing = elections[token.election_id];
      const newTypes = token.bypass_restrictions as string[];
      if (!existing) {
        elections[token.election_id] = {
          electionId: token.election_id,
          bypassedTypes: newTypes,
          validUntil,
        };
      } else {
        // Union of bypassed types; empty array means "all" → keep it all
        const merged =
          existing.bypassedTypes.length === 0 || newTypes.length === 0
            ? []
            : [...new Set([...existing.bypassedTypes, ...newTypes])];
        elections[token.election_id] = {
          electionId: token.election_id,
          bypassedTypes: merged,
          validUntil: Math.max(existing.validUntil, validUntil),
        };
      }
    }
  }

  const info: UserBypassInfo = { global, elections };
  await setCachedBypass(userId, info);
  return info;
}

/**
 * Check if a user has an active election bypass and return the bypassed
 * restriction types. Returns null if no bypass applies.
 * Empty string[] means "bypass ALL restriction types".
 */
export async function getElectionBypassForUser(
  userId: string,
  electionId: string,
): Promise<string[] | null> {
  const info = await getUserBypassInfo(userId);
  const entry = info.elections[electionId];
  if (!entry) return null;
  if (entry.validUntil < Date.now()) return null;
  return entry.bypassedTypes;
}

/**
 * Get all election bypasses for a user keyed by electionId.
 * Used in list endpoints to avoid N+1 queries.
 */
export async function getAllElectionBypassesForUser(
  userId: string,
): Promise<Record<string, string[]>> {
  const info = await getUserBypassInfo(userId);
  const now = Date.now();
  const result: Record<string, string[]> = {};
  for (const [electionId, entry] of Object.entries(info.elections)) {
    if (entry.validUntil >= now) result[electionId] = entry.bypassedTypes;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Token application
// ---------------------------------------------------------------------------

export class BypassTokenError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 404 | 409,
  ) {
    super(message);
    this.name = 'BypassTokenError';
  }
}

/**
 * Validate a raw bypass token and create (or confirm) a usage record for
 * the given user. Idempotent: calling twice with the same user+token is safe.
 *
 * @returns the token's type and optional electionId for redirect purposes
 */
export async function applyBypassToken(
  userId: string,
  rawToken: string,
): Promise<{ type: 'GLOBAL' | 'ELECTION'; electionId: string | null }> {
  const { createHash } = await import('crypto');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  const token = await prisma.bypassToken.findUnique({ where: { token_hash: tokenHash } });

  if (!token) throw new BypassTokenError('Invalid bypass token', 404);
  if (token.valid_until < new Date()) throw new BypassTokenError('Bypass token has expired', 400);

  // Upsert usage (idempotent)
  const existing = await prisma.bypassTokenUsage.findUnique({
    where: { token_hash_user_id: { token_hash: tokenHash, user_id: userId } },
  });

  if (existing) {
    if (existing.revoked_at) throw new BypassTokenError('Your bypass access has been revoked', 400);
    // Already applied — just return success
  } else {
    await prisma.bypassTokenUsage.create({
      data: { token_hash: tokenHash, user_id: userId },
    });
  }

  await invalidateUserBypassCache(userId);

  return {
    type: token.type as 'GLOBAL' | 'ELECTION',
    electionId: token.election_id,
  };
}
