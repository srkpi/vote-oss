import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { GROUP_NAME_MAX_LENGTH } from '@/lib/constants';
import { Errors } from '@/lib/errors';
import {
  GroupForbiddenError,
  GroupNotFoundError,
  invalidateGroupMembershipsForUsers,
  invalidateUserOwnedGroups,
} from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';

const MEMBER_SELECT = {
  id: true,
  user_id: true,
  display_name: true,
  joined_at: true,
  deleted_at: true,
} as const;

const INVITE_LINK_SELECT = {
  id: true,
  label: true,
  max_usage: true,
  current_usage: true,
  expires_at: true,
  created_by: true,
  created_at: true,
  deleted_at: true,
  deleted_by: true,
  usages: {
    select: { id: true, user_id: true, used_at: true },
    orderBy: { used_at: 'desc' as const },
  },
} as const;

async function fetchGroupDetail(
  groupId: string,
  callerId: string,
  isAdminWithManageGroups: boolean,
) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      owner_id: true,
      created_by: true,
      created_at: true,
      updated_at: true,
      deleted_at: true,
      members: {
        where: { deleted_at: null },
        select: MEMBER_SELECT,
        orderBy: [{ joined_at: 'asc' }],
      },
      invite_links: {
        select: {
          ...INVITE_LINK_SELECT,
          group_id: true,
        },
        orderBy: { created_at: 'desc' },
      },
      _count: {
        select: { members: { where: { deleted_at: null } } },
      },
    },
  });

  if (!group) throw new GroupNotFoundError();

  const isOwner = group.owner_id === callerId;
  const isMember = group.members.some((m) => m.user_id === callerId);
  const canManage = isOwner || isAdminWithManageGroups;

  // Non-members who are not admins with manage_groups cannot see group details
  if (!isMember && !isAdminWithManageGroups) {
    throw new GroupForbiddenError('You are not a member of this group');
  }

  return {
    id: group.id,
    name: group.name,
    ownerId: group.owner_id,
    createdBy: group.created_by,
    createdAt: group.created_at.toISOString(),
    updatedAt: group.updated_at.toISOString(),
    memberCount: group._count.members,
    isOwner,
    isMember,
    deletedAt: group.deleted_at?.toISOString() ?? null,
    members: group.members.map((m) => ({
      userId: m.user_id,
      displayName: m.display_name,
      joinedAt: m.joined_at.toISOString(),
      isOwner: m.user_id === group.owner_id,
    })),
    // Only expose invite links to group owner or admins with manage_groups
    inviteLinks: canManage
      ? group.invite_links.map((link) => ({
          id: link.id,
          groupId: link.group_id,
          label: link.label,
          maxUsage: link.max_usage,
          currentUsage: link.current_usage,
          expiresAt: link.expires_at.toISOString(),
          createdBy: link.created_by,
          createdAt: link.created_at.toISOString(),
          deletedAt: link.deleted_at?.toISOString() ?? null,
          deletedBy: link.deleted_by,
          usages: link.usages.map((u) => ({
            id: u.id,
            userId: u.user_id,
            usedAt: u.used_at.toISOString(),
          })),
          canRevoke: !link.deleted_at,
        }))
      : [],
  };
}

/**
 * @swagger
 * /api/groups/{id}:
 *   get:
 *     summary: Get group details including members and invite links
 *     tags: [Groups]
 *     security:
 *       - cookieAuth: []
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid group id');

  const isAdminWithManageGroups = (auth.user.isAdmin ?? false) && (auth.user.manageGroups ?? false);

  try {
    const detail = await fetchGroupDetail(id, auth.user.sub, isAdminWithManageGroups);
    return NextResponse.json(detail);
  } catch (err) {
    if (err instanceof GroupNotFoundError) return Errors.notFound(err.message);
    if (err instanceof GroupForbiddenError) return Errors.forbidden(err.message);
    throw err;
  }
}

/**
 * @swagger
 * /api/groups/{id}:
 *   patch:
 *     summary: Rename a group
 *     description: Only the group owner may rename the group.
 *     tags: [Groups]
 *     security:
 *       - cookieAuth: []
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid group id');

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const name = body.name?.trim();
  if (!name) return Errors.badRequest('name is required');
  if (name.length > GROUP_NAME_MAX_LENGTH) {
    return Errors.badRequest(`name must be at most ${GROUP_NAME_MAX_LENGTH} characters`);
  }

  const group = await prisma.group.findUnique({
    where: { id },
    select: { owner_id: true, deleted_at: true },
  });

  if (!group || group.deleted_at) return Errors.notFound('Group not found');
  if (group.owner_id !== auth.user.sub) {
    return Errors.forbidden('Only the group owner can rename the group');
  }

  await prisma.group.update({
    where: { id },
    data: { name, updated_by: auth.user.sub },
  });

  // Invalidate owned-groups cache so the election form reflects the new name
  await invalidateUserOwnedGroups(auth.user.sub);

  return new NextResponse(null, { status: 204 });
}

/**
 * @swagger
 * /api/groups/{id}:
 *   delete:
 *     summary: Soft-delete a group
 *     description: >
 *       Marks the group as deleted.  Only the group owner or an admin with
 *       manage_groups may delete a group.
 *     tags: [Groups]
 *     security:
 *       - cookieAuth: []
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid group id');

  const isAdminWithManageGroups = (auth.user.isAdmin ?? false) && (auth.user.manageGroups ?? false);

  const group = await prisma.group.findUnique({
    where: { id },
    select: {
      owner_id: true,
      deleted_at: true,
      members: {
        where: { deleted_at: null },
        select: { user_id: true },
      },
    },
  });

  if (!group || group.deleted_at) return Errors.notFound('Group not found');

  if (group.owner_id !== auth.user.sub && !isAdminWithManageGroups) {
    return Errors.forbidden('Only the group owner or a groups admin can delete this group');
  }

  const now = new Date();

  await prisma.group.update({
    where: { id },
    data: { deleted_at: now, deleted_by: auth.user.sub },
  });

  // Invalidate membership caches for all members so their election eligibility
  // is immediately re-evaluated
  const memberIds = group.members.map((m) => m.user_id);
  await Promise.all([
    invalidateGroupMembershipsForUsers(memberIds),
    invalidateUserOwnedGroups(group.owner_id),
  ]);

  return new NextResponse(null, { status: 204 });
}
