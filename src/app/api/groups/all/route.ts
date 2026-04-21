import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

/**
 * @swagger
 * /api/groups/all:
 *   get:
 *     summary: List all groups (admin only)
 *     description: >
 *       Returns every non-deleted group in the system with member counts and
 *       owner information.  Requires admin authentication with manage_groups
 *       permission.
 *     tags: [Groups]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of all groups
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – not an admin or missing manage_groups permission
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  if (!auth.admin.manage_groups) {
    return Errors.forbidden('manage_groups permission required');
  }

  const groups = await prisma.group.findMany({
    where: { deleted_at: null },
    select: {
      id: true,
      name: true,
      owner_id: true,
      created_at: true,
      deleted_at: true,
      _count: { select: { members: { where: { deleted_at: null } } } },
      // We can't directly join to a user table since users are external;
      // instead we fetch the owner's display_name from group_members
      members: {
        where: { deleted_at: null },
        select: { user_id: true, display_name: true },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  return NextResponse.json(
    groups.map((g) => {
      const ownerMember = g.members.find((m) => m.user_id === g.owner_id);
      return {
        id: g.id,
        name: g.name,
        ownerId: g.owner_id,
        ownerName: ownerMember?.display_name ?? null,
        memberCount: g._count.members,
        createdAt: g.created_at.toISOString(),
        deletedAt: g.deleted_at?.toISOString() ?? null,
      };
    }),
  );
}
