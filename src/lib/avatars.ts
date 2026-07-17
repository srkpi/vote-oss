/**
 * Batched, cache-first resolution of avatar URLs by external user id.
 *
 * Mirrors the `overlayLiveBallotCounts` pattern in `lib/cache.ts`: a single
 * Redis pipeline round-trip regardless of how many ids are requested, with
 * Postgres consulted only for ids that aren't cached yet (or have never had
 * an avatar, which is also cached as an explicit "no avatar" sentinel so we
 * don't repeatedly query the DB for the common case).
 */

import { CACHE_KEY_AVATAR_PREFIX, CACHE_TTL_AVATAR_SECS } from '@/lib/constants';
import { fileProxyUrl } from '@/lib/files';
import { prisma } from '@/lib/prisma';
import { redis, safeRedis } from '@/lib/redis';

function avatarCacheKey(userId: string): string {
  return `${CACHE_KEY_AVATAR_PREFIX}${userId}`;
}

/**
 * Resolve avatar URLs for a batch of external user ids.
 *
 * The returned map only contains entries for users that currently HAVE an
 * avatar — absence from the map means "no avatar", so callers should do
 * `map.get(id) ?? null` rather than checking for an explicit null value.
 */
export async function getAvatarUrlMap(userIds: readonly string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)].filter(Boolean);
  const result = new Map<string, string>();
  if (ids.length === 0) return result;

  const cached = await safeRedis(async () => {
    const pipeline = redis.pipeline();
    for (const id of ids) pipeline.get(avatarCacheKey(id));
    return pipeline.exec();
  });

  const missing: string[] = [];
  if (cached) {
    ids.forEach((id, i) => {
      const [err, raw] = cached[i] as [Error | null, string | null];
      if (err || raw === null) {
        missing.push(id); // never cached / expired
      } else if (raw !== '') {
        result.set(id, raw); // '' is the "confirmed no avatar" sentinel
      }
    });
  } else {
    missing.push(...ids); // Redis unavailable — fall back to DB for everyone
  }

  if (missing.length > 0) {
    const rows = await prisma.userProfile.findMany({
      where: { id: { in: missing }, avatar_file_id: { not: null } },
      select: { id: true, avatar_file: { select: { object_key: true } } },
    });
    const foundUrls = new Map(
      rows.filter((r) => r.avatar_file).map((r) => [r.id, fileProxyUrl(r.avatar_file!.object_key)]),
    );

    await safeRedis(async () => {
      const pipeline = redis.pipeline();
      for (const id of missing) {
        const url = foundUrls.get(id);
        if (url) {
          result.set(id, url);
          pipeline.set(avatarCacheKey(id), url, 'EX', CACHE_TTL_AVATAR_SECS);
        } else {
          pipeline.set(avatarCacheKey(id), '', 'EX', CACHE_TTL_AVATAR_SECS);
        }
      }
      return pipeline.exec();
    });
  }

  return result;
}

/** Write-through cache update — call right after a successful avatar upload. */
export async function setCachedAvatarUrl(userId: string, url: string): Promise<void> {
  await safeRedis(() => redis.set(avatarCacheKey(userId), url, 'EX', CACHE_TTL_AVATAR_SECS));
}

/** Write-through cache update — call right after a successful avatar removal. */
export async function clearCachedAvatarUrl(userId: string): Promise<void> {
  await safeRedis(() => redis.set(avatarCacheKey(userId), '', 'EX', CACHE_TTL_AVATAR_SECS));
}

/**
 * Convenience merge for the extremely common `{ userId, fullName }` shape
 * (Admin, ElectionAuthor, InviteToken.creator, GroupMemberSummary, …).
 * Never mutates the input.
 */
export function withAvatarUrl<T extends { userId: string }>(
  entity: T,
  avatarMap: Map<string, string>,
): T & { avatarUrl: string | null } {
  return { ...entity, avatarUrl: avatarMap.get(entity.userId) ?? null };
}
