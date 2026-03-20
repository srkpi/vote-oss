import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { getCachedAdmins, setCachedAdmins } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isAncestorInGraph } from '@/lib/utils';
import type { Admin } from '@/types/admin';

// ---------------------------------------------------------------------------
// Helper: compute the set of active admin IDs that `currentUserId` may delete.
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
    const activeIds = cached.map((a) => a.userId);
    const deletableIds = computeDeletableIds(graph, activeIds, user.sub);
    return NextResponse.json(
      cached.map((admin) => ({ ...admin, deletable: deletableIds.has(admin.userId) })),
    );
  }

  const admins = await prisma.admin.findMany({
    where: { deleted_at: null },
    select: {
      user_id: true,
      full_name: true,
      group: true,
      faculty: true,
      promoter: { select: { user_id: true, full_name: true } },
      promoted_at: true,
      manage_admins: true,
      restricted_to_faculty: true,
    },
    orderBy: { promoted_at: 'asc' },
  });

  const camelAdmins: Admin[] = admins.map((a) => ({
    userId: a.user_id,
    fullName: a.full_name,
    group: a.group,
    faculty: a.faculty,
    promoter: a.promoter ? { userId: a.promoter.user_id, fullName: a.promoter.full_name } : null,
    promotedAt: a.promoted_at.toISOString(),
    manageAdmins: a.manage_admins,
    restrictedToFaculty: a.restricted_to_faculty,
  }));

  await setCachedAdmins(camelAdmins);

  const activeIds = camelAdmins.map((a) => a.userId);
  const deletableIds = computeDeletableIds(graph, activeIds, user.sub);

  return NextResponse.json(
    camelAdmins.map((admin) => ({
      ...admin,
      deletable: deletableIds.has(admin.userId),
    })),
  );
}
