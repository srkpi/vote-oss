import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin, requireAuth } from '@/lib/auth';
import { GROUP_MAX_OWNED, GROUP_NAME_MAX_LENGTH } from '@/lib/constants';
import { Errors } from '@/lib/errors';
import { invalidateUserOwnedGroups } from '@/lib/groups';
import { prisma } from '@/lib/prisma';

/**
 * @swagger
 * /api/groups:
 *   get:
 *     summary: List groups the caller belongs to or owns
 *     description: >
 *       Returns all non-deleted groups the caller is an active member of.
 *       Each entry includes a computed `isOwner` and `isMember` flag.
 *       Admins with `manage_groups` additionally receive every group in the
 *       system via the `/api/admin/groups` endpoint.
 *     tags: [Groups]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of groups
 *       401:
 *         description: Unauthorized
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { user } = auth;

  // Fetch all active memberships for the caller, including soft-deleted groups
  // so we can surface "you were removed from X" if needed in future — for now
  // we only return active groups.
  const memberships = await prisma.groupMember.findMany({
    where: {
      user_id: user.sub,
      deleted_at: null,
      group: { deleted_at: null },
    },
    select: {
      group: {
        select: {
          id: true,
          name: true,
          owner_id: true,
          created_by: true,
          created_at: true,
          updated_at: true,
          deleted_at: true,
          _count: {
            select: { members: { where: { deleted_at: null } } },
          },
        },
      },
    },
    orderBy: { joined_at: 'asc' },
  });

  return NextResponse.json(
    memberships.map(({ group }) => ({
      id: group.id,
      name: group.name,
      ownerId: group.owner_id,
      createdBy: group.created_by,
      createdAt: group.created_at.toISOString(),
      updatedAt: group.updated_at.toISOString(),
      memberCount: group._count.members,
      isOwner: group.owner_id === user.sub,
      isMember: true,
      deletedAt: group.deleted_at?.toISOString() ?? null,
    })),
  );
}

/**
 * @swagger
 * /api/groups:
 *   post:
 *     summary: Create a new group
 *     description: >
 *       Creates a group and automatically adds the creator as its owner and
 *       first member.  A user may own at most GROUP_MAX_OWNED groups at a time.
 *     tags: [Groups]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *     responses:
 *       201:
 *         description: Group created
 *       400:
 *         description: Validation error or ownership limit reached
 *       401:
 *         description: Unauthorized
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return Errors.forbidden(auth.error);

  const { user, admin } = auth;

  if (!admin.manage_groups) {
    return Errors.forbidden('Only admin with manage groups permission can create groups');
  }

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

  // Enforce per-user owned group cap
  const ownedCount = await prisma.group.count({
    where: { owner_id: user.sub, deleted_at: null },
  });

  if (ownedCount >= GROUP_MAX_OWNED) {
    return Errors.badRequest(`You can own at most ${GROUP_MAX_OWNED} groups simultaneously`);
  }

  // Create group + owner member record in a transaction
  const group = await prisma.$transaction(async (tx) => {
    const newGroup = await tx.group.create({
      data: {
        name,
        owner_id: user.sub,
        created_by: user.sub,
      },
    });

    await tx.groupMember.create({
      data: {
        group_id: newGroup.id,
        user_id: user.sub,
        display_name: user.fullName,
      },
    });

    return newGroup;
  });

  // Invalidate owned-groups cache so the election form picks up the new group
  await invalidateUserOwnedGroups(user.sub);

  return NextResponse.json(
    {
      id: group.id,
      name: group.name,
      ownerId: group.owner_id,
      createdBy: group.created_by,
      createdAt: group.created_at.toISOString(),
      updatedAt: group.updated_at.toISOString(),
      memberCount: 1,
      isOwner: true,
      isMember: true,
      deletedAt: null,
    },
    { status: 201 },
  );
}
