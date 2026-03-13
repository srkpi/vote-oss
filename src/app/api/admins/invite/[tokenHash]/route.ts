import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { invalidateInviteTokens } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isAncestorInGraph } from '@/lib/utils';

// ---------------------------------------------------------------------------
// DELETE /api/admins/invite/[tokenHash]
//
// Deletes an invite token.  The caller must:
//   1. Be an admin with manage_admins.
//   2. Either own the token (created_by === caller) OR be a transitive
//      ancestor of the token's creator in the admin hierarchy.
// ---------------------------------------------------------------------------

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
    // Load the full hierarchy graph in one query, then resolve ancestry in memory
    const graphNodes = await prisma.admin.findMany({
      select: { user_id: true, promoted_by: true },
    });
    const graph = new Map(graphNodes.map((n) => [n.user_id, n.promoted_by]));

    if (!isAncestorInGraph(graph, user.sub, token.created_by)) {
      return Errors.forbidden(
        'You can only delete invite tokens created by admins in your hierarchy',
      );
    }
  }

  await prisma.adminInviteToken.delete({ where: { token_hash: tokenHash } });
  await invalidateInviteTokens();

  return NextResponse.json({ ok: true, deletedTokenHash: tokenHash });
}
