import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { invalidateUserBypassCache } from '@/lib/bypass';
import { Errors } from '@/lib/errors';
import { buildAdminGraph, isAncestorInGraph } from '@/lib/graph';
import { prisma } from '@/lib/prisma';

/**
 * DELETE /api/bypass/[tokenHash]
 * Hard-delete a global or election bypass token (and cascade its usages).
 *
 * Permissions:
 *   – creator can always delete their own token
 *   – any ancestor in the admin hierarchy can delete
 *   – for GLOBAL tokens non-restricted admins only (restricted admins cannot
 *     manage global tokens at all)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tokenHash: string }> },
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { tokenHash } = await params;
  if (!tokenHash) return Errors.badRequest('tokenHash is required');

  const globalToken = await prisma.globalBypassToken.findUnique({
    where: { token_hash: tokenHash },
    include: { usages: { select: { user_id: true } } },
  });

  if (globalToken) {
    if (auth.admin.restricted_to_faculty) {
      return Errors.forbidden('Only unrestricted admins can delete global bypass tokens');
    }

    if (globalToken.created_by !== auth.user.sub) {
      const adminGraph = await buildAdminGraph();
      if (!isAncestorInGraph(adminGraph, auth.user.sub, globalToken.created_by)) {
        return Errors.forbidden(
          'You can only delete bypass tokens in your own branch of the hierarchy',
        );
      }
    }

    const affectedUserIds = globalToken.usages.map((u) => u.user_id);
    await prisma.globalBypassToken.delete({ where: { token_hash: tokenHash } });
    await Promise.all(affectedUserIds.map((uid) => invalidateUserBypassCache(uid)));
    return new NextResponse(null, { status: 204 });
  }

  const electionToken = await prisma.electionBypassToken.findUnique({
    where: { token_hash: tokenHash },
    include: { usages: { select: { user_id: true } } },
  });

  if (!electionToken) return Errors.notFound('Bypass token not found');

  if (electionToken.created_by !== auth.user.sub) {
    const adminGraph = await buildAdminGraph();
    if (!isAncestorInGraph(adminGraph, auth.user.sub, electionToken.created_by)) {
      return Errors.forbidden(
        'You can only delete bypass tokens in your own branch of the hierarchy',
      );
    }
  }

  const affectedUserIds = electionToken.usages.map((u) => u.user_id);
  await prisma.electionBypassToken.delete({ where: { token_hash: tokenHash } });
  await Promise.all(affectedUserIds.map((uid) => invalidateUserBypassCache(uid)));

  return new NextResponse(null, { status: 204 });
}
