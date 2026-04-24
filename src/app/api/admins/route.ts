import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { getCachedAdmins, setCachedAdmins } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { isAncestorInGraph } from '@/lib/graph';
import { prisma } from '@/lib/prisma';
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

/**
 * @swagger
 * /api/admins:
 *   get:
 *     summary: List all active admins
 *     description: >
 *       Returns every non-deleted admin record, augmented with a `deletable`
 *       flag indicating whether the caller may remove that admin. Results are
 *       served from cache when available. Requires admin authentication.
 *     tags:
 *       - Admins
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of admin records
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/Admin'
 *                   - type: object
 *                     properties:
 *                       deletable:
 *                         type: boolean
 *                         description: Whether the calling admin may delete this record
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – caller is not an admin
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { user } = auth;

  const cached = await getCachedAdmins();
  if (cached) {
    const graph = new Map(cached.map((a) => [a.userId, a.promoter?.userId ?? null]));
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
      manage_groups: true,
      manage_petitions: true,
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
    manageGroups: a.manage_groups,
    managePetitions: a.manage_petitions,
  }));

  await setCachedAdmins(camelAdmins);

  const graph = new Map(camelAdmins.map((a) => [a.userId, a.promoter?.userId ?? null]));
  const activeIds = camelAdmins.map((a) => a.userId);
  const deletableIds = computeDeletableIds(graph, activeIds, user.sub);

  return NextResponse.json(
    camelAdmins.map((admin) => ({
      ...admin,
      deletable: deletableIds.has(admin.userId),
    })),
  );
}
