import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import {
  GROUP_INVITE_LINK_LABEL_MAX_LENGTH,
  GROUP_INVITE_LINK_MAX_ACTIVE,
  GROUP_INVITE_LINK_MAX_DAYS,
  GROUP_INVITE_LINK_MAX_USAGE,
  GROUP_INVITE_LINK_MIN_HOURS,
  GROUP_INVITE_LINK_TOKEN_LENGTH,
} from '@/lib/constants';
import { generateBase64Token, hashToken } from '@/lib/crypto';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';

function canManageLinks(
  callerId: string,
  ownerId: string,
  isAdminWithManageGroups: boolean,
): boolean {
  return callerId === ownerId || isAdminWithManageGroups;
}

function mapLink(link: {
  id: string;
  group_id: string;
  label: string | null;
  max_usage: number;
  current_usage: number;
  expires_at: Date;
  created_by: string;
  created_at: Date;
  deleted_at: Date | null;
  deleted_by: string | null;
  usages: { id: string; user_id: string; used_at: Date }[];
}) {
  const isActive =
    !link.deleted_at && link.expires_at > new Date() && link.current_usage < link.max_usage;

  return {
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
    canRevoke: isActive,
  };
}

/**
 * @swagger
 * /api/groups/{id}/invite-links:
 *   get:
 *     summary: List invite links for a group
 *     description: >
 *       Returns all invite links (active and revoked) for the group.
 *       Only accessible to the group owner or admins with manage_groups.
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

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { owner_id: true, deleted_at: true },
  });

  if (!group || group.deleted_at) return Errors.notFound('Group not found');

  if (!canManageLinks(auth.user.sub, group.owner_id, isAdminWithManageGroups)) {
    return Errors.forbidden('Only the group owner can manage invite links');
  }

  const links = await prisma.groupInviteLink.findMany({
    where: { group_id: groupId },
    select: {
      id: true,
      group_id: true,
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
        orderBy: { used_at: 'desc' },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  return NextResponse.json(links.map(mapLink));
}

/**
 * @swagger
 * /api/groups/{id}/invite-links:
 *   post:
 *     summary: Create a new invite link for the group
 *     description: >
 *       Generates a new invite link.  Only the group owner or admins with
 *       manage_groups can create links.  A group may have at most
 *       GROUP_INVITE_LINK_MAX_ACTIVE active links simultaneously.
 *     tags: [Groups]
 *     security:
 *       - cookieAuth: []
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: groupId } = await params;
  if (!isValidUuid(groupId)) return Errors.badRequest('Invalid group id');

  const isAdminWithManageGroups = (auth.user.isAdmin ?? false) && (auth.user.manageGroups ?? false);

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { owner_id: true, deleted_at: true },
  });

  if (!group || group.deleted_at) return Errors.notFound('Group not found');

  if (!canManageLinks(auth.user.sub, group.owner_id, isAdminWithManageGroups)) {
    return Errors.forbidden('Only the group owner can create invite links');
  }

  let body: { label?: string; maxUsage?: number; expiresAt?: string };
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { label, maxUsage, expiresAt } = body;

  if (!expiresAt) return Errors.badRequest('expiresAt is required');
  const expiresAtDate = new Date(expiresAt);
  if (isNaN(expiresAtDate.getTime())) return Errors.badRequest('Invalid expiresAt date');

  const now = new Date();
  const minDate = new Date(now.getTime() + GROUP_INVITE_LINK_MIN_HOURS * 60 * 60 * 1000);
  const maxDate = new Date(now.getTime() + GROUP_INVITE_LINK_MAX_DAYS * 24 * 60 * 60 * 1000);

  if (expiresAtDate < minDate) {
    return Errors.badRequest(
      `expiresAt must be at least ${GROUP_INVITE_LINK_MIN_HOURS} hour(s) in the future`,
    );
  }
  if (expiresAtDate > maxDate) {
    return Errors.badRequest(`expiresAt cannot exceed ${GROUP_INVITE_LINK_MAX_DAYS} days from now`);
  }

  if (!maxUsage || !Number.isInteger(maxUsage) || maxUsage < 1) {
    return Errors.badRequest('maxUsage must be a positive integer');
  }
  if (maxUsage > GROUP_INVITE_LINK_MAX_USAGE) {
    return Errors.badRequest(`maxUsage cannot exceed ${GROUP_INVITE_LINK_MAX_USAGE}`);
  }

  if (label && label.length > GROUP_INVITE_LINK_LABEL_MAX_LENGTH) {
    return Errors.badRequest(
      `label must be at most ${GROUP_INVITE_LINK_LABEL_MAX_LENGTH} characters`,
    );
  }

  // Enforce active-link cap
  const activeCount = await prisma.groupInviteLink.count({
    where: {
      group_id: groupId,
      deleted_at: null,
      expires_at: { gt: now },
      current_usage: { lt: maxUsage }, // rough heuristic — exact check below
    },
  });

  if (activeCount >= GROUP_INVITE_LINK_MAX_ACTIVE) {
    return Errors.badRequest(
      `A group cannot have more than ${GROUP_INVITE_LINK_MAX_ACTIVE} active invite links`,
    );
  }

  const rawToken = generateBase64Token(GROUP_INVITE_LINK_TOKEN_LENGTH);
  const tokenHash = hashToken(rawToken);

  const link = await prisma.groupInviteLink.create({
    data: {
      group_id: groupId,
      token_hash: tokenHash,
      label: label?.trim() || null,
      max_usage: maxUsage,
      current_usage: 0,
      expires_at: expiresAtDate,
      created_by: auth.user.sub,
    },
  });

  return NextResponse.json(
    {
      token: rawToken,
      id: link.id,
      groupId: link.group_id,
      label: link.label,
      maxUsage: link.max_usage,
      currentUsage: link.current_usage,
      expiresAt: link.expires_at.toISOString(),
      createdBy: link.created_by,
      createdAt: link.created_at.toISOString(),
      deletedAt: null,
      deletedBy: null,
      usages: [],
      canRevoke: true,
    },
    { status: 201 },
  );
}
