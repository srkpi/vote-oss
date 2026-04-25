/**
 * Groups library
 *
 * Provides:
 *  - Per-user group membership cache (similar to bypass token cache)
 *  - Owned-groups cache for election restriction UX
 *  - Core query helpers used by API routes
 */

import {
  CACHE_TTL_GROUP_MEMBERSHIPS_SECS,
  CACHE_TTL_GROUP_OWNED_SECS,
  CACHE_TTL_GROUP_VKSU_IDS_SECS,
} from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { redis, safeRedis } from '@/lib/redis';
import type { GroupOption } from '@/types/group';

// ────────────────────────────────────────────────────────────────────────────
// Cache key helpers
// ────────────────────────────────────────────────────────────────────────────

function membershipCacheKey(userId: string): string {
  return `cache:group-memberships:user:${userId}`;
}

function ownedGroupsCacheKey(userId: string): string {
  return `cache:group-owned:user:${userId}`;
}

const VKSU_GROUP_IDS_CACHE_KEY = 'cache:group-vksu-ids';

// ────────────────────────────────────────────────────────────────────────────
// Membership cache
// ────────────────────────────────────────────────────────────────────────────

/**
 * Returns the set of group IDs the user is an active (non-deleted) member of.
 * Uses Redis with a 5-minute TTL and falls back to the database on cache miss.
 */
export async function getUserGroupMemberships(userId: string): Promise<string[]> {
  const raw = await safeRedis(() => redis.get(membershipCacheKey(userId)));
  if (raw !== null) {
    try {
      return JSON.parse(raw) as string[];
    } catch {
      // corrupted cache – fall through to DB
    }
  }

  const memberships = await prisma.groupMember.findMany({
    where: {
      user_id: userId,
      deleted_at: null,
      group: { deleted_at: null },
    },
    select: { group_id: true },
  });

  const groupIds = memberships.map((m) => m.group_id);
  await safeRedis(() =>
    redis.set(
      membershipCacheKey(userId),
      JSON.stringify(groupIds),
      'EX',
      CACHE_TTL_GROUP_MEMBERSHIPS_SECS,
    ),
  );

  return groupIds;
}

/** Invalidate the membership cache for a user (call on join/leave/kick). */
export async function invalidateUserGroupMemberships(userId: string): Promise<void> {
  await safeRedis(() => redis.del(membershipCacheKey(userId)));
}

/** Invalidate membership caches for multiple users at once. */
export async function invalidateGroupMembershipsForUsers(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  await safeRedis(async () => {
    const pipeline = redis.pipeline();
    for (const uid of userIds) {
      pipeline.del(membershipCacheKey(uid));
    }
    return pipeline.exec();
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Owned-groups cache (used in election creation form)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Returns a lightweight summary of all groups owned by the user.
 * Used in the election creation form to offer GROUP_MEMBERSHIP restrictions.
 */
export async function getUserOwnedGroups(userId: string): Promise<GroupOption[]> {
  const raw = await safeRedis(() => redis.get(ownedGroupsCacheKey(userId)));
  if (raw !== null) {
    try {
      return JSON.parse(raw) as GroupOption[];
    } catch {
      // fall through
    }
  }

  const groups = await prisma.group.findMany({
    where: { owner_id: userId, deleted_at: null },
    select: {
      id: true,
      name: true,
      _count: { select: { members: { where: { deleted_at: null } } } },
    },
    orderBy: { name: 'asc' },
  });

  const result: GroupOption[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    memberCount: g._count.members,
  }));

  await safeRedis(() =>
    redis.set(
      ownedGroupsCacheKey(userId),
      JSON.stringify(result),
      'EX',
      CACHE_TTL_GROUP_OWNED_SECS,
    ),
  );

  return result;
}

export async function invalidateUserOwnedGroups(userId: string): Promise<void> {
  await safeRedis(() => redis.del(ownedGroupsCacheKey(userId)));
}

// ────────────────────────────────────────────────────────────────────────────
// VKSU group IDs cache
//
// A single Redis key holds the IDs of every active group with type=VKSU.
// The set is small (one entry per ВКСУ group) and changes only when an admin
// flips a group's type, so a global cache is cheaper than per-user keys —
// `isVKSUMember` then only needs to intersect this with the caller's
// memberships, which are already cached.
// ────────────────────────────────────────────────────────────────────────────

async function getCachedVKSUGroupIds(): Promise<string[]> {
  const raw = await safeRedis(() => redis.get(VKSU_GROUP_IDS_CACHE_KEY));
  if (raw !== null) {
    try {
      return JSON.parse(raw) as string[];
    } catch {
      // fall through
    }
  }

  const groups = await prisma.group.findMany({
    where: { type: 'VKSU', deleted_at: null },
    select: { id: true },
  });

  const ids = groups.map((g) => g.id);
  await safeRedis(() =>
    redis.set(VKSU_GROUP_IDS_CACHE_KEY, JSON.stringify(ids), 'EX', CACHE_TTL_GROUP_VKSU_IDS_SECS),
  );

  return ids;
}

/** Invalidate the global VKSU-group-IDs cache (call when a group's type changes or a VKSU group is deleted). */
export async function invalidateVKSUGroupIds(): Promise<void> {
  await safeRedis(() => redis.del(VKSU_GROUP_IDS_CACHE_KEY));
}

/**
 * Returns true when `userId` is an active member of at least one VKSU group.
 * ВКСУ membership grants the same privileges as ВКСУ — used to gate candidate
 * registration form management.
 */
export async function isVKSUMember(userId: string): Promise<boolean> {
  const [memberships, vksuIds] = await Promise.all([
    getUserGroupMemberships(userId),
    getCachedVKSUGroupIds(),
  ]);

  if (memberships.length === 0 || vksuIds.length === 0) return false;
  const vksuSet = new Set(vksuIds);
  return memberships.some((id) => vksuSet.has(id));
}

// ────────────────────────────────────────────────────────────────────────────
// Authorization helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Verify that `userId` is the owner of `groupId`.
 * Throws if the group doesn't exist, is deleted, or the user is not the owner.
 */
export async function requireGroupOwner(
  groupId: string,
  userId: string,
): Promise<{ id: string; name: string; owner_id: string }> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, name: true, owner_id: true, deleted_at: true },
  });

  if (!group || group.deleted_at) {
    throw new GroupNotFoundError();
  }

  if (group.owner_id !== userId) {
    throw new GroupForbiddenError();
  }

  return group;
}

/**
 * Verify that `userId` is an active member (including owner) of `groupId`.
 */
export async function requireGroupMember(groupId: string, userId: string): Promise<void> {
  const member = await prisma.groupMember.findUnique({
    where: {
      group_id_user_id: { group_id: groupId, user_id: userId },
    },
    select: { deleted_at: true },
  });

  if (!member || member.deleted_at) {
    throw new GroupForbiddenError();
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Custom errors
// ────────────────────────────────────────────────────────────────────────────

export class GroupNotFoundError extends Error {
  constructor() {
    super('Group not found');
    this.name = 'GroupNotFoundError';
  }
}

export class GroupForbiddenError extends Error {
  constructor(message = 'You do not have permission to perform this action') {
    super(message);
    this.name = 'GroupForbiddenError';
  }
}

export class GroupConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GroupConflictError';
  }
}
