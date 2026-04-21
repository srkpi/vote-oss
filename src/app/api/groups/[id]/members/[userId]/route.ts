import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { invalidateUserGroupMemberships } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';

/**
 * @swagger
 * /api/groups/{id}/members/{userId}:
 *   delete:
 *     summary: Remove a member from a group (kick or self-leave)
 *     description: >
 *       - Any member may call this endpoint with their own userId to **leave** the group.
 *       - The group owner may call this to **kick** any member except themselves.
 *         (Owner must transfer ownership first before leaving.)
 *       - Admins with manage_groups may kick any member from any group.
 *     tags: [Groups]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Member removed
 *       400:
 *         description: Owner cannot leave without transferring ownership
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Group or member not found
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: groupId, userId: targetUserId } = await params;
  if (!isValidUuid(groupId)) return Errors.badRequest('Invalid group id');
  if (!targetUserId) return Errors.badRequest('userId is required');

  const callerId = auth.user.sub;
  const isSelf = callerId === targetUserId;
  const isAdminWithManageGroups = (auth.user.isAdmin ?? false) && (auth.user.manageGroups ?? false);

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { owner_id: true, deleted_at: true },
  });

  if (!group || group.deleted_at) return Errors.notFound('Group not found');

  const isOwner = callerId === group.owner_id;

  // Authorization check:
  // - Self-leave: always allowed for any member (but not the owner)
  // - Kick: only owner or admin with manage_groups
  if (!isSelf && !isOwner && !isAdminWithManageGroups) {
    return Errors.forbidden('You do not have permission to remove members from this group');
  }

  // The owner cannot leave or be kicked directly; they must transfer ownership first
  if (targetUserId === group.owner_id) {
    return Errors.badRequest(
      'The group owner cannot be removed. Transfer ownership to another member first.',
    );
  }

  // Ensure the target is actually an active member
  const membership = await prisma.groupMember.findUnique({
    where: {
      group_id_user_id: { group_id: groupId, user_id: targetUserId },
    },
    select: { id: true, deleted_at: true },
  });

  if (!membership || membership.deleted_at) {
    return Errors.notFound('Member not found in this group');
  }

  await prisma.groupMember.update({
    where: { group_id_user_id: { group_id: groupId, user_id: targetUserId } },
    data: { deleted_at: new Date(), deleted_by: callerId },
  });

  // Invalidate the removed user's group membership cache
  await invalidateUserGroupMemberships(targetUserId);

  return new NextResponse(null, { status: 204 });
}
