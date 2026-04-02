import { CACHE_TTL_BYPASS_SECS } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { redis, safeRedis } from '@/lib/redis';
import type { ElectionBypassInfo, GlobalBypassInfo, UserBypassInfo } from '@/types/bypass';

function bypassCacheKey(userId: string): string {
  return `cache:bypass:user:${userId}`;
}

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

export async function getUserBypassInfo(userId: string): Promise<UserBypassInfo> {
  const cached = await getCachedBypass(userId);
  if (cached) {
    const now = Date.now();
    const global = cached.global && cached.global.validUntil > now ? cached.global : null;
    const elections: Record<string, ElectionBypassInfo> = {};
    for (const [electionId, info] of Object.entries(cached.elections)) {
      if (info.validUntil > now) elections[electionId] = info;
    }
    return { global, elections };
  }

  const now = new Date();

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
          bypass_graduate: true,
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
      global = {
        bypassNotStudying: token.bypass_not_studying,
        bypassGraduate: token.bypass_graduate,
        validUntil,
      };
    } else if (token.type === 'ELECTION' && token.election_id) {
      // Multiple election bypasses: merge bypassedTypes (union)
      const existing = elections[token.election_id];
      const newTypes = token.bypass_restrictions as string[];

      // Empty array means bypass nothing — skip this token if no types specified
      if (newTypes.length === 0) continue;

      if (!existing) {
        elections[token.election_id] = {
          electionId: token.election_id,
          bypassedTypes: newTypes,
          validUntil,
        };
      } else {
        elections[token.election_id] = {
          electionId: token.election_id,
          bypassedTypes: [...new Set([...existing.bypassedTypes, ...newTypes])],
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
  if (entry.bypassedTypes.length === 0) return null;
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
    if (entry.validUntil >= now && entry.bypassedTypes.length > 0) {
      result[electionId] = entry.bypassedTypes;
    }
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

  // Check max usage limit
  if (token.max_usage !== null && token.current_usage >= token.max_usage) {
    throw new BypassTokenError('Bypass token has reached its usage limit', 400);
  }

  const existing = await prisma.bypassTokenUsage.findUnique({
    where: { token_hash_user_id: { token_hash: tokenHash, user_id: userId } },
  });

  if (existing) {
    if (existing.revoked_at) throw new BypassTokenError('Your bypass access has been revoked', 400);
    // Already applied idempotently — no increment
  } else {
    // New usage: create record + increment current_usage atomically
    await prisma.$transaction([
      prisma.bypassTokenUsage.create({
        data: { token_hash: tokenHash, user_id: userId },
      }),
      prisma.bypassToken.update({
        where: { token_hash: tokenHash },
        data: { current_usage: { increment: 1 } },
      }),
    ]);
  }

  await invalidateUserBypassCache(userId);

  return {
    type: token.type as 'GLOBAL' | 'ELECTION',
    electionId: token.election_id,
  };
}
