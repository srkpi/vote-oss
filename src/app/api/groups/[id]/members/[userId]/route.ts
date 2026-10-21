import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { parseRequestBody } from '@/lib/api/request';
import { requireAuth } from '@/lib/auth';
import { GROUP_MEMBER_ROLE_MAX_LENGTH } from '@/lib/constants';
import { Errors } from '@/lib/errors';
import { invalidateUserGroupMemberships } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { groupMemberRoleBodySchema } from '@/lib/schemas/group';
import { isValidUuid } from '@/lib/utils/common';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return Errors.unauthorized(auth.error);
  }

  const { id: groupId, userId: targetUserId } = await params;
  if (!isValidUuid(groupId)) {
    return Errors.badRequest('Invalid group id');
  }
  if (!targetUserId) {
    return Errors.badRequest('userId is required');
  }

  const callerId = auth.user.sub;
  const isSelf = callerId === targetUserId;
  const isAdminWithManageGroups = (auth.user.isAdmin ?? false) && (auth.user.manageGroups ?? false);

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { owner_id: true, deleted_at: true },
  });

  if (!group || group.deleted_at) {
    return Errors.notFound('Group not found');
  }

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return Errors.unauthorized(auth.error);
  }

  const { id: groupId, userId: targetUserId } = await params;
  if (!isValidUuid(groupId)) {
    return Errors.badRequest('Invalid group id');
  }
  if (!targetUserId) {
    return Errors.badRequest('userId is required');
  }

  const parsedBody = await parseRequestBody(req, groupMemberRoleBodySchema);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;
  if (!('role' in body)) {
    return Errors.badRequest('role is required (string or null)');
  }

  let normalizedRole: string | null;
  if (body.role === null) {
    normalizedRole = null;
  } else if (typeof body.role !== 'string') {
    return Errors.badRequest('role must be a string or null');
  } else {
    const trimmed = body.role.trim();
    if (trimmed.length === 0) {
      normalizedRole = null;
    } else if (trimmed.length > GROUP_MEMBER_ROLE_MAX_LENGTH) {
      return Errors.badRequest(`role must be at most ${GROUP_MEMBER_ROLE_MAX_LENGTH} characters`);
    } else {
      normalizedRole = trimmed;
    }
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { owner_id: true, deleted_at: true },
  });
  if (!group || group.deleted_at) {
    return Errors.notFound('Group not found');
  }
  if (group.owner_id !== auth.user.sub) {
    return Errors.forbidden('Only the group owner can edit member roles');
  }

  const membership = await prisma.groupMember.findUnique({
    where: { group_id_user_id: { group_id: groupId, user_id: targetUserId } },
    select: { id: true, deleted_at: true },
  });
  if (!membership || membership.deleted_at) {
    return Errors.notFound('Member not found in this group');
  }

  await prisma.groupMember.update({
    where: { group_id_user_id: { group_id: groupId, user_id: targetUserId } },
    data: { role: normalizedRole },
  });

  return new NextResponse(null, { status: 204 });
}
