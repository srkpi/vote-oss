import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';

/**
 * @swagger
 * /api/groups/{id}/members:
 *   get:
 *     summary: List active members of a group
 *     description: >
 *       Returns all non-deleted members.  Only accessible to current members
 *       of the group or admins with manage_groups.
 *     tags: [Groups]
 *     security:
 *       - cookieAuth: []
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: groupId } = await params;
  if (!isValidUuid(groupId)) return Errors.badRequest('Invalid group id');

  const isAdminWithManageGroups = (auth.user.isAdmin ?? false) && (auth.user.manageGroups ?? false);

  // Verify the group exists
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, owner_id: true, deleted_at: true },
  });

  if (!group || group.deleted_at) return Errors.notFound('Group not found');

  // Check caller is a member or a groups admin
  if (!isAdminWithManageGroups) {
    const callerMembership = await prisma.groupMember.findUnique({
      where: {
        group_id_user_id: { group_id: groupId, user_id: auth.user.sub },
      },
      select: { deleted_at: true },
    });

    if (!callerMembership || callerMembership.deleted_at) {
      return Errors.forbidden('You are not a member of this group');
    }
  }

  const members = await prisma.groupMember.findMany({
    where: { group_id: groupId, deleted_at: null },
    select: {
      user_id: true,
      display_name: true,
      joined_at: true,
    },
    orderBy: { joined_at: 'asc' },
  });

  return NextResponse.json(
    members.map((m) => ({
      userId: m.user_id,
      displayName: m.display_name,
      joinedAt: m.joined_at.toISOString(),
      isOwner: m.user_id === group.owner_id,
    })),
  );
}
