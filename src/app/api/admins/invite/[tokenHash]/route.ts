import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { invalidateInviteTokens } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { buildAdminGraph, isAncestorInGraph } from '@/lib/graph';
import { prisma } from '@/lib/prisma';

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
  if (!tokenHash) {
    return Errors.badRequest('tokenHash is required');
  }

  const token = await prisma.adminInviteToken.findUnique({
    where: { token_hash: tokenHash },
  });

  if (!token) {
    return Errors.notFound('Invite token not found');
  }

  // Owner may always delete their own token without a graph query
  if (token.created_by !== user.sub) {
    const graph = await buildAdminGraph();
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
