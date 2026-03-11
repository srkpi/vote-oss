import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { getCachedAdmins, setCachedAdmins } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isAncestorInGraph } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helper: compute the set of active admin IDs that `currentUserId` may delete.
//
// Takes the FULL hierarchy graph (including soft-deleted nodes) so that
// transitive chains through removed intermediaries are preserved:
//
//   A → B[deleted] → C
//
// Without the deleted B in the graph, C would appear un-deletable by A even
// though A is C's transitive root.  By walking the full graph we correctly
// resolve C as deletable.
//
// Only IDs present in `activeAdminIds` are ever added to the result set —
// deleted admins are never surfaced to callers.
// ---------------------------------------------------------------------------
function computeDeletableIds(
  graph: Map<string, string | null>,
  activeAdminIds: string[],
  currentUserId: string,
): Set<string> {
  const deletable = new Set<string>();
  for (const adminId of activeAdminIds) {
    if (isAncestorInGraph(graph, currentUserId, adminId)) {
      deletable.add(adminId);
    }
  }
  return deletable;
}

// ---------------------------------------------------------------------------
// GET /api/admins
// Returns only active (non-deleted) admins.
// Served from a 30-second Redis cache (invalidated on mutations).
//
// The deletable flag is always computed against the FULL hierarchy graph
// (one lightweight query, no joins) so deleted intermediaries do not break
// transitive chains.  Even on a cache hit we issue this cheap query.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { user } = auth;

  const graphNodes = await prisma.admin.findMany({
    select: { user_id: true, promoted_by: true },
  });
  const graph = new Map(graphNodes.map((n) => [n.user_id, n.promoted_by]));

  const cached = await getCachedAdmins();
  if (cached) {
    const activeIds = cached.map((a) => a.user_id);
    const deletableIds = computeDeletableIds(graph, activeIds, user.sub);
    return NextResponse.json(
      cached.map((admin) => ({ ...admin, deletable: deletableIds.has(admin.user_id) })),
    );
  }

  const admins = await prisma.admin.findMany({
    where: { deleted_at: null },
    select: {
      user_id: true,
      full_name: true,
      group: true,
      faculty: true,
      promoted_by: true,
      promoted_at: true,
      manage_admins: true,
      restricted_to_faculty: true,
    },
    orderBy: { promoted_at: 'asc' },
  });

  await setCachedAdmins(admins as Parameters<typeof setCachedAdmins>[0]);

  const activeIds = admins.map((a) => a.user_id);
  const deletableIds = computeDeletableIds(graph, activeIds, user.sub);

  return NextResponse.json(
    admins.map((admin) => ({
      ...admin,
      deletable: deletableIds.has(admin.user_id),
    })),
  );
}
