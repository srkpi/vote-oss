import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';

/**
 * @swagger
 * /api/groups/{id}/invite-links/{linkId}:
 *   delete:
 *     summary: Revoke an invite link
 *     description: >
 *       Soft-deletes the invite link so it can no longer be used to join the group.
 *       Existing memberships obtained through the link are unaffected.
 *       Only the group owner or admins with manage_groups can revoke links.
 *     tags: [Groups]
 *     security:
 *       - cookieAuth: []
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: groupId, linkId } = await params;
  if (!isValidUuid(groupId)) return Errors.badRequest('Invalid group id');
  if (!isValidUuid(linkId)) return Errors.badRequest('Invalid link id');

  const isAdminWithManageGroups = (auth.user.isAdmin ?? false) && (auth.user.manageGroups ?? false);

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { owner_id: true, deleted_at: true },
  });

  if (!group || group.deleted_at) return Errors.notFound('Group not found');

  if (auth.user.sub !== group.owner_id && !isAdminWithManageGroups) {
    return Errors.forbidden('Only the group owner can revoke invite links');
  }

  const link = await prisma.groupInviteLink.findUnique({
    where: { id: linkId },
    select: { group_id: true, deleted_at: true },
  });

  if (!link) return Errors.notFound('Invite link not found');
  if (link.group_id !== groupId) return Errors.notFound('Invite link not found');
  if (link.deleted_at) return Errors.badRequest('Invite link is already revoked');

  await prisma.groupInviteLink.update({
    where: { id: linkId },
    data: { deleted_at: new Date(), deleted_by: auth.user.sub },
  });

  return new NextResponse(null, { status: 204 });
}
