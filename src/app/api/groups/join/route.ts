import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { hashToken } from '@/lib/crypto';
import { Errors } from '@/lib/errors';
import { invalidateUserGroupMemberships } from '@/lib/groups';
import { prisma } from '@/lib/prisma';

/**
 * @swagger
 * /api/groups/join:
 *   post:
 *     summary: Join a group via invite token
 *     description: >
 *       Validates and applies a raw group invite token.  Idempotent — joining
 *       a group you are already a member of returns success without incrementing
 *       the usage counter.
 *     tags: [Groups]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Joined (or already a member)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 groupId:
 *                   type: string
 *                   format: uuid
 *                 groupName:
 *                   type: string
 *       400:
 *         description: Token expired or usage limit reached
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Invalid token
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { user } = auth;

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { token } = body;
  if (!token || typeof token !== 'string') {
    return Errors.badRequest('token is required');
  }

  const tokenHash = hashToken(token);
  const now = new Date();

  const link = await prisma.groupInviteLink.findUnique({
    where: { token_hash: tokenHash },
    select: {
      id: true,
      group_id: true,
      max_usage: true,
      current_usage: true,
      expires_at: true,
      deleted_at: true,
      group: {
        select: { id: true, name: true, deleted_at: true },
      },
    },
  });

  if (!link) return Errors.notFound('Invalid invite token');
  if (link.deleted_at) return Errors.badRequest('This invite link has been revoked');
  if (link.expires_at < now) return Errors.badRequest('This invite link has expired');
  if (link.current_usage >= link.max_usage) {
    return Errors.badRequest('This invite link has reached its maximum usage');
  }
  if (link.group.deleted_at) return Errors.badRequest('This group no longer exists');

  // Check idempotency — already a member?
  const existingMembership = await prisma.groupMember.findUnique({
    where: {
      group_id_user_id: { group_id: link.group_id, user_id: user.sub },
    },
    select: { deleted_at: true },
  });

  if (existingMembership && !existingMembership.deleted_at) {
    // Already an active member — idempotent success
    return NextResponse.json({ groupId: link.group_id, groupName: link.group.name });
  }

  if (existingMembership && existingMembership.deleted_at) {
    const existingUsage = await prisma.groupInviteLinkUsage.findUnique({
      where: {
        link_id_user_id: {
          link_id: link.id,
          user_id: user.sub,
        },
      },
    });

    if (existingUsage) {
      return Errors.forbidden('You have already used this invite link');
    }

    // Re-joining after being removed — restore membership and increment usage
    await prisma.$transaction([
      prisma.groupMember.update({
        where: { group_id_user_id: { group_id: link.group_id, user_id: user.sub } },
        data: {
          deleted_at: null,
          deleted_by: null,
          display_name: user.fullName,
          joined_at: now,
        },
      }),
      prisma.groupInviteLink.update({
        where: { id: link.id },
        data: { current_usage: { increment: 1 } },
      }),
      prisma.groupInviteLinkUsage.create({
        data: { link_id: link.id, user_id: user.sub },
      }),
    ]);
  } else {
    // First time joining
    await prisma.$transaction([
      prisma.groupMember.create({
        data: {
          group_id: link.group_id,
          user_id: user.sub,
          display_name: user.fullName,
        },
      }),
      prisma.groupInviteLink.update({
        where: { id: link.id },
        data: { current_usage: { increment: 1 } },
      }),
      prisma.groupInviteLinkUsage.create({
        data: { link_id: link.id, user_id: user.sub },
      }),
    ]);
  }

  // Invalidate the user's membership cache
  await invalidateUserGroupMemberships(user.sub);

  return NextResponse.json({ groupId: link.group_id, groupName: link.group.name });
}
