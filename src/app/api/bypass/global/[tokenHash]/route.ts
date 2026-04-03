import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { invalidateUserBypassCache } from '@/lib/bypass';
import { Errors } from '@/lib/errors';
import { buildAdminGraph, isAncestorInGraph } from '@/lib/graph';
import { prisma } from '@/lib/prisma';

/**
 * @swagger
 * /api/bypass/global/{tokenHash}:
 *   delete:
 *     summary: Soft-delete a global bypass token
 *     description: >
 *       Marks the specified global bypass token as deleted (sets `deleted_at`).
 *       The token and its usage history remain visible for audit purposes.
 *       Only non-restricted admins may manage global bypass tokens.
 *       The caller must be the creator or a transitive ancestor in the admin
 *       hierarchy.
 *     tags:
 *       - Bypass
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: tokenHash
 *         required: true
 *         schema:
 *           type: string
 *         description: SHA-256 hex hash of the raw bypass token
 *     responses:
 *       204:
 *         description: Token soft-deleted
 *       400:
 *         description: Missing tokenHash or token already deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – restricted admin or insufficient hierarchy
 *       404:
 *         description: Token not found
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tokenHash: string }> },
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  if (auth.admin.restricted_to_faculty) {
    return Errors.forbidden('Only unrestricted admins can delete global bypass tokens');
  }

  const { tokenHash } = await params;
  if (!tokenHash) return Errors.badRequest('tokenHash is required');

  const token = await prisma.globalBypassToken.findUnique({
    where: { token_hash: tokenHash },
    include: { usages: { select: { user_id: true } } },
  });

  if (!token) return Errors.notFound('Global bypass token not found');
  if (token.deleted_at) return Errors.badRequest('Token is already deleted');

  if (token.created_by !== auth.user.sub) {
    const adminGraph = await buildAdminGraph();
    if (!isAncestorInGraph(adminGraph, auth.user.sub, token.created_by)) {
      return Errors.forbidden(
        'You can only delete bypass tokens in your own branch of the hierarchy',
      );
    }
  }

  await prisma.globalBypassTokenUsage.updateMany({
    where: { token_hash: tokenHash },
    data: { revoked_at: new Date() },
  });
  await prisma.globalBypassToken.update({
    where: { token_hash: tokenHash },
    data: { deleted_at: new Date() },
  });

  // Invalidate bypass cache for all users who used this token so they lose
  // the bypass access on the next request.
  const affectedUserIds = token.usages.map((u) => u.user_id);
  await Promise.all(affectedUserIds.map((uid) => invalidateUserBypassCache(uid)));

  return new NextResponse(null, { status: 204 });
}
