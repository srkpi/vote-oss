import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { getCachedAdmins, invalidateAdmins, invalidateInviteTokens } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isAncestorInGraph } from '@/lib/utils';

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
    restrictedToFaculty: admin.restricted_to_faculty,
  });
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

  // Build the hierarchy graph from cache (active admins only).
  // Since soft-deleted admins are guaranteed to have no children, active-only
  // nodes are sufficient for ancestry checks.
  const cachedAdmins = await getCachedAdmins();
  const graph: Map<string, string | null> = cachedAdmins
    ? new Map(cachedAdmins.map((a) => [a.userId, a.promoter?.userId ?? null]))
    : new Map(
        (
          await prisma.admin.findMany({
            where: { deleted_at: null },
            select: { user_id: true, promoted_by: true },
          })
        ).map((n) => [n.user_id, n.promoted_by]),
      );

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
