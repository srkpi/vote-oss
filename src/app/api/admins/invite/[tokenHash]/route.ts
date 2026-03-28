import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { getCachedAdmins, invalidateInviteTokens } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isAncestorInGraph } from '@/lib/utils';

/**
 * @swagger
 * /api/admins/invite/{tokenHash}:
 *   delete:
 *     summary: Delete an invite token
 *     description: >
 *       Permanently deletes a single admin invite token identified by its
 *       hash. The caller must have `manage_admins` and either own the token
 *       or be a transitive ancestor of the token's creator in the admin
 *       hierarchy.
 *     tags:
 *       - Admin Invites
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: tokenHash
 *         required: true
 *         schema:
 *           type: string
 *         description: SHA-256 hash of the raw invite token
 *     responses:
 *       204:
 *         description: Token deleted
 *       400:
 *         description: Missing tokenHash
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – no manage_admins or token is outside caller's hierarchy
 *       404:
 *         description: Invite token not found
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tokenHash: string }> },
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { admin, user } = auth;

  if (!admin.manage_admins) {
    return Errors.forbidden('You do not have permission to delete invite tokens');
  }

  const { tokenHash } = await params;
  if (!tokenHash) return Errors.badRequest('tokenHash is required');

  const token = await prisma.adminInviteToken.findUnique({
    where: { token_hash: tokenHash },
  });

  if (!token) return Errors.notFound('Invite token not found');

  // Owner may always delete their own token without a graph query
  if (token.created_by !== user.sub) {
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

    if (!isAncestorInGraph(graph, user.sub, token.created_by)) {
      return Errors.forbidden(
        'You can only delete invite tokens created by admins in your hierarchy',
      );
    }
  }

  await prisma.adminInviteToken.delete({ where: { token_hash: tokenHash } });
  await invalidateInviteTokens();

  return new NextResponse(null, { status: 204 });
}
