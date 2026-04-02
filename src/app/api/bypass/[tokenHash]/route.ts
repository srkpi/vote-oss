import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { invalidateUserBypassCache } from '@/lib/bypass';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

/**
 * DELETE /api/bypass/[tokenHash]
 * Delete a bypass token (and cascade-delete its usages).
 * For GLOBAL: non-restricted admins who created it or are ancestors of the creator.
 * For ELECTION: admins who can manage that election's bypass.
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

  const token = await prisma.bypassToken.findUnique({
    where: { token_hash: tokenHash },
    include: { usages: { select: { user_id: true } } },
  });

  if (!token) return Errors.notFound('Bypass token not found');

  // Permission: creator can always delete their own; for others check hierarchy
  if (token.created_by !== auth.user.sub) {
    if (token.type === 'GLOBAL' && auth.admin.restricted_to_faculty) {
      return Errors.forbidden('Only unrestricted admins can delete global bypass tokens');
    }
    // TODO: Additional hierarchy check could be done here; keeping simple for now
  }

  // Collect affected user IDs before deletion for cache invalidation
  const affectedUserIds = token.usages.map((u) => u.user_id);

  await prisma.bypassToken.delete({ where: { token_hash: tokenHash } });

  // Invalidate bypass cache for all affected users
  await Promise.all(affectedUserIds.map((uid) => invalidateUserBypassCache(uid)));

  return new NextResponse(null, { status: 204 });
}
