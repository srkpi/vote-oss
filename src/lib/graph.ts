import { getCachedAdmins } from '@/lib/cache';
import { prisma } from '@/lib/prisma';

/**
 * Build a userId → promoted_by map from the cached admin list (preferred)
 * or from the database when the cache is cold.
 */
export async function buildAdminGraph(): Promise<Map<string, string | null>> {
  const cachedAdmins = await getCachedAdmins();
  if (cachedAdmins) {
    return new Map(cachedAdmins.map((a) => [a.userId, a.promoter?.userId ?? null]));
  }
  const dbAdmins = await prisma.admin.findMany({
    where: { deleted_at: null },
    select: { user_id: true, promoted_by: true },
  });
  return new Map(dbAdmins.map((a) => [a.user_id, a.promoted_by]));
}

/**
 * Walk the in-memory graph upward from `targetUserId` and return true if
 * `ancestorId` appears anywhere in the chain.
 *
 * O(depth) — no database I/O. A visited-set guards against cycles.
 */
export function isAncestorInGraph(
  graph: Map<string, string | null>,
  ancestorId: string,
  targetUserId: string,
): boolean {
  const visited = new Set<string>();
  let currentId: string | null = targetUserId;

  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const promotedBy: string | null = graph.get(currentId) ?? null;
    if (promotedBy === ancestorId) return true;
    currentId = promotedBy;
  }

  return false;
}
