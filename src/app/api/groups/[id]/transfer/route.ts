import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { invalidateUserOwnedGroups } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';

/**
 * @swagger
 * /api/groups/{id}/transfer:
 *   post:
 *     summary: Transfer group ownership
 *     description: >
 *       Transfers ownership of the group to another active member.
 *       The previous owner becomes a plain member.
 *       - The group owner can transfer to any active member.
 *       - An admin with manage_groups can transfer ownership to **themselves**
 *         regardless of current ownership (takeover for moderation purposes).
 *     tags: [Groups]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newOwnerId]
 *             properties:
 *               newOwnerId:
 *                 type: string
 *                 description: User ID of the member who will become the new owner
 *     responses:
 *       204:
 *         description: Ownership transferred
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Group or target member not found
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: groupId } = await params;
  if (!isValidUuid(groupId)) return Errors.badRequest('Invalid group id');

  let body: { newOwnerId?: string };
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { newOwnerId } = body;
  if (!newOwnerId || typeof newOwnerId !== 'string') {
    return Errors.badRequest('newOwnerId is required');
  }

  const callerId = auth.user.sub;
  const isAdminWithManageGroups = (auth.user.isAdmin ?? false) && (auth.user.manageGroups ?? false);

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { owner_id: true, deleted_at: true },
  });

  if (!group || group.deleted_at) return Errors.notFound('Group not found');

  const isCurrentOwner = callerId === group.owner_id;

  // Authorization:
  // - Owner can transfer to any active member
  // - Admin with manage_groups can only transfer TO themselves (admin takeover)
  if (!isCurrentOwner && !isAdminWithManageGroups) {
    return Errors.forbidden('Only the group owner can transfer ownership');
  }

  if (isAdminWithManageGroups && !isCurrentOwner && newOwnerId !== callerId) {
    return Errors.forbidden('Admins with manage_groups can only transfer ownership to themselves');
  }

  if (newOwnerId === group.owner_id) {
    return Errors.badRequest('The specified user is already the group owner');
  }

  // Verify the new owner is an active member
  const newOwnerMembership = await prisma.groupMember.findUnique({
    where: {
      group_id_user_id: { group_id: groupId, user_id: newOwnerId },
    },
    select: { deleted_at: true },
  });

  // If admin is taking over, they may not yet be a member — add them
  if (isAdminWithManageGroups && newOwnerId === callerId && !newOwnerMembership) {
    await prisma.groupMember.create({
      data: {
        group_id: groupId,
        user_id: callerId,
        display_name: auth.user.fullName,
      },
    });
  } else if (!newOwnerMembership || newOwnerMembership.deleted_at) {
    return Errors.notFound('The specified user is not an active member of this group');
  }

  await prisma.group.update({
    where: { id: groupId },
    data: { owner_id: newOwnerId, updated_by: callerId },
  });

  // Invalidate owned-groups cache for both previous and new owner
  await Promise.all([
    invalidateUserOwnedGroups(group.owner_id),
    invalidateUserOwnedGroups(newOwnerId),
  ]);

  return new NextResponse(null, { status: 204 });
}
