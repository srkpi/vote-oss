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
 *     summary: Revoke (soft-delete) an invite link
 *     description: >
 *       Marks the invite link as revoked so it can no longer be used to join
 *       the group. Existing memberships obtained through the link are
 *       unaffected. The group owner or an admin with `manage_groups` may
 *       revoke links.
 *     tags:
 *       - Groups
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Group UUID
 *       - in: path
 *         name: linkId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Invite link UUID
 *     responses:
 *       204:
 *         description: Link revoked
 *       400:
 *         description: Invalid UUID or link is already revoked
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Caller is neither the group owner nor an admin with manage_groups
 *       404:
 *         description: Group not found, link not found, or link does not belong to this group
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
