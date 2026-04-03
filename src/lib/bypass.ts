import { createHash } from 'crypto';

import { CACHE_TTL_BYPASS_SECS } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { redis, safeRedis } from '@/lib/redis';
import type { ElectionBypassInfo, GlobalBypassInfo, UserBypassInfo } from '@/types/bypass';

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Core bypass-info query
// ---------------------------------------------------------------------------

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

  const [globalUsages, electionUsages] = await Promise.all([
    prisma.globalBypassTokenUsage.findMany({
      where: {
        user_id: userId,
        revoked_at: null,
        token: { valid_until: { gt: now } },
      },
      include: {
        token: {
          select: {
            bypass_not_studying: true,
            bypass_graduate: true,
            valid_until: true,
          },
        },
      },
    }),
    prisma.electionBypassTokenUsage.findMany({
      where: {
        user_id: userId,
        revoked_at: null,
        token: {
          election: {
            closes_at: { gt: now },
            deleted_at: null,
          },
        },
      },
      include: {
        token: {
          select: {
            election_id: true,
            bypass_restrictions: true,
            election: { select: { closes_at: true } },
          },
        },
      },
    }),
  ]);

  // Take the most recently valid global bypass (last one wins if multiple active)
  let global: GlobalBypassInfo | null = null;
  for (const usage of globalUsages) {
    const { token } = usage;
    global = {
      bypassNotStudying: token.bypass_not_studying,
      bypassGraduate: token.bypass_graduate,
      validUntil: token.valid_until.getTime(),
    };
  }

  // Merge election bypasses per election (union of bypassed types)
  const elections: Record<string, ElectionBypassInfo> = {};
  for (const usage of electionUsages) {
    const { token } = usage;
    if (!token.election_id) continue;
    const newTypes = token.bypass_restrictions as string[];
    if (newTypes.length === 0) continue;

    const validUntil = token.election.closes_at.getTime();
    const existing = elections[token.election_id];

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

  const info: UserBypassInfo = { global, elections };
  await setCachedBypass(userId, info);
  return info;
}

/**
 * Returns the bypassed restriction types for a specific election, or null.
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
 * All active election bypasses keyed by electionId (avoids N+1 in list views).
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
 * Validate and apply a raw bypass token for a user. Idempotent.
 * Tries GlobalBypassToken first, then ElectionBypassToken.
 */
export async function applyBypassToken(
  userId: string,
  rawToken: string,
): Promise<{ type: 'GLOBAL' | 'ELECTION'; electionId: string | null }> {
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const globalToken = await prisma.globalBypassToken.findUnique({
    where: { token_hash: tokenHash },
  });

  if (globalToken) {
    if (globalToken.valid_until < new Date()) {
      throw new BypassTokenError('Bypass token has expired', 400);
    }
    if (globalToken.current_usage >= globalToken.max_usage) {
      throw new BypassTokenError('Bypass token has reached its usage limit', 400);
    }

    const existing = await prisma.globalBypassTokenUsage.findUnique({
      where: { token_hash_user_id: { token_hash: tokenHash, user_id: userId } },
    });

    if (existing) {
      if (existing.revoked_at) {
        throw new BypassTokenError('Your bypass access has been revoked', 400);
      }
      // Already applied — idempotent, no increment
    } else {
      await prisma.$transaction([
        prisma.globalBypassTokenUsage.create({
          data: { token_hash: tokenHash, user_id: userId },
        }),
        prisma.globalBypassToken.update({
          where: { token_hash: tokenHash },
          data: { current_usage: { increment: 1 } },
        }),
      ]);
    }

    await invalidateUserBypassCache(userId);
    return { type: 'GLOBAL', electionId: null };
  }

  const electionToken = await prisma.electionBypassToken.findUnique({
    where: { token_hash: tokenHash },
    include: { election: { select: { closes_at: true, deleted_at: true } } },
  });

  if (!electionToken) throw new BypassTokenError('Invalid bypass token', 404);

  if (electionToken.election.deleted_at) {
    throw new BypassTokenError('Election has been deleted', 400);
  }
  if (new Date() > electionToken.election.closes_at) {
    throw new BypassTokenError('Election has already closed', 400);
  }
  if (electionToken.current_usage >= electionToken.max_usage) {
    throw new BypassTokenError('Bypass token has reached its usage limit', 400);
  }

  const existing = await prisma.electionBypassTokenUsage.findUnique({
    where: { token_hash_user_id: { token_hash: tokenHash, user_id: userId } },
  });

  if (existing) {
    if (existing.revoked_at) throw new BypassTokenError('Your bypass access has been revoked', 400);
  } else {
    await prisma.$transaction([
      prisma.electionBypassTokenUsage.create({
        data: { token_hash: tokenHash, user_id: userId },
      }),
      prisma.electionBypassToken.update({
        where: { token_hash: tokenHash },
        data: { current_usage: { increment: 1 } },
      }),
    ]);
  }

  await invalidateUserBypassCache(userId);
  return { type: 'ELECTION', electionId: electionToken.election_id };
}
