import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { invalidateUserBypassCache } from '@/lib/bypass';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

/**
 * DELETE /api/bypass/[tokenHash]/usages/[userId]
 * Revoke a specific user's bypass access (sets revoked_at = now).
 *
 * Permissions:
 *   – non-restricted admins can revoke usages on any token
 *   – restricted admins can only revoke usages on tokens they created
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tokenHash: string; userId: string }> },
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { tokenHash, userId } = await params;
  if (!tokenHash || !userId) return Errors.badRequest('tokenHash and userId are required');

  const globalToken = await prisma.globalBypassToken.findUnique({
    where: { token_hash: tokenHash },
  });

  if (globalToken) {
    if (globalToken.created_by !== auth.user.sub && auth.admin.restricted_to_faculty) {
      return Errors.forbidden('Insufficient permissions to revoke bypass usage');
    }

    const usage = await prisma.globalBypassTokenUsage.findUnique({
      where: { token_hash_user_id: { token_hash: tokenHash, user_id: userId } },
    });
    if (!usage) return Errors.notFound('Bypass usage not found');
    if (usage.revoked_at) return Errors.conflict('Bypass usage is already revoked');

    await prisma.globalBypassTokenUsage.update({
      where: { token_hash_user_id: { token_hash: tokenHash, user_id: userId } },
      data: { revoked_at: new Date() },
    });
    await invalidateUserBypassCache(userId);
    return new NextResponse(null, { status: 204 });
  }

  const electionToken = await prisma.electionBypassToken.findUnique({
    where: { token_hash: tokenHash },
  });

  if (!electionToken) return Errors.notFound('Bypass token not found');

  if (electionToken.created_by !== auth.user.sub && auth.admin.restricted_to_faculty) {
    return Errors.forbidden('Insufficient permissions to revoke bypass usage');
  }

  const usage = await prisma.electionBypassTokenUsage.findUnique({
    where: { token_hash_user_id: { token_hash: tokenHash, user_id: userId } },
  });

  if (!usage) return Errors.notFound('Bypass usage not found');
  if (usage.revoked_at) return Errors.conflict('Bypass usage is already revoked');

  await prisma.electionBypassTokenUsage.update({
    where: { token_hash_user_id: { token_hash: tokenHash, user_id: userId } },
    data: { revoked_at: new Date() },
  });

  await invalidateUserBypassCache(userId);

  return new NextResponse(null, { status: 204 });
}
