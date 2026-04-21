import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { getCachedAdmins, invalidateAdmins, invalidateInviteTokens } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { buildAdminGraph, isAncestorInGraph } from '@/lib/graph';
import { prisma } from '@/lib/prisma';

/**
 * @swagger
 * /api/admins/{userId}:
 *   get:
 *     summary: Get a single admin by user ID
 *     description: Returns full admin details for the given user ID. Served from cache when available. Requires admin authentication.
 *     tags:
 *       - Admins
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID of the admin to retrieve
 *     responses:
 *       200:
 *         description: Admin record
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Admin'
 *       400:
 *         description: Missing userId
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – caller is not an admin
 *       404:
 *         description: Admin not found
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { userId } = await params;
  if (!userId) return Errors.badRequest('userId is required');

  // Serve from cache when available
  const cached = await getCachedAdmins();
  if (cached) {
    const admin = cached.find((a) => a.userId === userId);
    if (!admin) return Errors.notFound('Admin not found');
    return NextResponse.json(admin);
  }

  // Cache miss: fall through to DB
  const admin = await prisma.admin.findUnique({
    where: { user_id: userId },
    select: {
      user_id: true,
      full_name: true,
      group: true,
      faculty: true,
      promoter: { select: { user_id: true, full_name: true } },
      promoted_at: true,
      manage_admins: true,
      manage_groups: true,
      restricted_to_faculty: true,
    },
  });

  if (!admin) return Errors.notFound('Admin not found');

  return NextResponse.json({
    userId: admin.user_id,
    fullName: admin.full_name,
    group: admin.group,
    faculty: admin.faculty,
    promoter: admin.promoter
      ? { userId: admin.promoter.user_id, fullName: admin.promoter.full_name }
      : null,
    promotedAt: admin.promoted_at.toISOString(),
    manageAdmins: admin.manage_admins,
    manageGroups: admin.manage_groups,
    restrictedToFaculty: admin.restricted_to_faculty,
  });
}

/**
 * @swagger
 * /api/admins/{userId}:
 *   patch:
 *     summary: Update an admin's permissions
 *     description: >
 *       Updates the `manageAdmins` and/or `restrictedToFaculty` flags for the
 *       target admin. The caller must have `manage_admins` and be a transitive
 *       ancestor of the target in the admin hierarchy. A caller who is
 *       `restricted_to_faculty` cannot grant `restrictedToFaculty: false`.
 *       When `manage_admins` changes all of the target's invite tokens are
 *       revoked. When `restricted_to_faculty` changes from false to true, invite
 *       tokens with `restricted_to_faculty: false` are deleted.
 *     tags:
 *       - Admins
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID of the admin to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               manageAdmins:
 *                 type: boolean
 *               restrictedToFaculty:
 *                 type: boolean
 *     responses:
 *       204:
 *         description: Permissions updated successfully
 *       400:
 *         description: Missing userId, attempting to update self, or no fields provided
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – no manage_admins, restricted caller granting unrestricted access, or target outside hierarchy
 *       404:
 *         description: Target admin not found
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { admin, user } = auth;

  if (!admin?.manage_admins) {
    return Errors.forbidden('You do not have permission to modify admin permissions');
  }

  const { userId: targetUserId } = await params;
  if (!targetUserId) return Errors.badRequest('userId is required');
  if (targetUserId === user.sub) return Errors.badRequest('You cannot modify your own permissions');

  let body: {
    manageAdmins?: boolean;
    manageGroups?: boolean;
    restrictedToFaculty?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { manageAdmins, manageGroups, restrictedToFaculty } = body;

  if (
    manageAdmins === undefined &&
    manageGroups === undefined &&
    restrictedToFaculty === undefined
  ) {
    return Errors.badRequest(
      'At least one of manageAdmins, manageGroups, or restrictedToFaculty must be provided',
    );
  }

  // A faculty-restricted caller cannot grant unrestricted access to others
  if (restrictedToFaculty === false && admin.restricted_to_faculty) {
    return Errors.forbidden(
      'You cannot grant unrestricted faculty access when you are restricted to faculty',
    );
  }

  // manage_groups can be granted regardless of restricted_to_faculty since it's
  // a cross-platform permission unrelated to faculty boundaries
  const targetAdmin = await prisma.admin.findUnique({ where: { user_id: targetUserId } });
  if (!targetAdmin || targetAdmin.deleted_at !== null) {
    return Errors.notFound('Admin not found');
  }

  const graph = await buildAdminGraph();
  if (!isAncestorInGraph(graph, user.sub, targetUserId)) {
    return Errors.forbidden('You can only modify admins in your own branch of the hierarchy');
  }

  const updateData: {
    manage_admins?: boolean;
    manage_groups?: boolean;
    restricted_to_faculty?: boolean;
  } = {};
  if (manageAdmins !== undefined) updateData.manage_admins = manageAdmins;
  if (manageGroups !== undefined) updateData.manage_groups = manageGroups;
  if (restrictedToFaculty !== undefined) updateData.restricted_to_faculty = restrictedToFaculty;

  await prisma.admin.update({
    where: { user_id: targetUserId },
    data: updateData,
  });

  await invalidateAdmins();

  // Determine what actually changed so we know which tokens to purge.
  const manageAdminsChanged =
    manageAdmins !== undefined && manageAdmins !== targetAdmin.manage_admins;

  const restrictedChangedToTrue =
    restrictedToFaculty === true && targetAdmin.restricted_to_faculty === false;

  if (manageAdminsChanged) {
    // Any change to manage_admins invalidates all of the target's invite tokens
    // because the permission granted by those tokens may now be wrong.
    await prisma.adminInviteToken.deleteMany({ where: { created_by: targetUserId } });
    await invalidateInviteTokens();
  } else if (restrictedChangedToTrue) {
    // Becoming restricted means any previously-issued unrestricted invite tokens
    // must be revoked (they could still grant restricted_to_faculty: false).
    await prisma.adminInviteToken.deleteMany({
      where: { created_by: targetUserId, restricted_to_faculty: false },
    });
    await invalidateInviteTokens();
  }

  return new NextResponse(null, { status: 204 });
}

/**
 * @swagger
 * /api/admins/{userId}:
 *   delete:
 *     summary: Remove an admin
 *     description: >
 *       Soft-deletes the target admin and hard-deletes all invite tokens they
 *       created. Direct children of the removed admin are re-parented to the
 *       removed admin's own parent, keeping the hierarchy intact without gaps.
 *       The caller must have `manage_admins` and be a transitive ancestor of
 *       the target in the admin hierarchy. A caller cannot remove themselves.
 *     tags:
 *       - Admins
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID of the admin to remove
 *     responses:
 *       204:
 *         description: Admin successfully removed
 *       400:
 *         description: Missing userId or attempting to remove self
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – no manage_admins permission or target is outside caller's hierarchy branch
 *       404:
 *         description: Target admin not found
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { admin, user } = auth;

  if (!admin?.manage_admins) {
    return Errors.forbidden('You do not have permission to remove admins');
  }

  const { userId: targetUserId } = await params;
  if (!targetUserId) return Errors.badRequest('userId is required');
  if (targetUserId === user.sub) return Errors.badRequest('You cannot remove yourself');

  const targetAdmin = await prisma.admin.findUnique({ where: { user_id: targetUserId } });
  if (!targetAdmin || targetAdmin.deleted_at !== null) {
    return Errors.notFound('Admin not found');
  }

  const graph = await buildAdminGraph();
  if (!isAncestorInGraph(graph, user.sub, targetUserId)) {
    return Errors.forbidden('You can only remove admins in your own branch of the hierarchy');
  }

  // Soft-delete the admin, re-parent their direct children to the admin's own
  // parent (fills the hierarchy gap), and hard-delete their invite tokens —
  // all atomically in one transaction.
  await prisma.$transaction([
    prisma.admin.update({
      where: { user_id: targetUserId },
      data: { deleted_at: new Date(), deleted_by: user.sub },
    }),
    // Re-parent direct children so the hierarchy stays intact
    prisma.admin.updateMany({
      where: { promoted_by: targetUserId },
      data: { promoted_by: graph.get(targetUserId) ?? null },
    }),
    prisma.adminInviteToken.deleteMany({
      where: { created_by: targetUserId },
    }),
  ]);

  await Promise.all([invalidateAdmins(), invalidateInviteTokens()]);

  return new NextResponse(null, { status: 204 });
}
