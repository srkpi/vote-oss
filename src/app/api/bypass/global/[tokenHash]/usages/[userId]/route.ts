import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { invalidateUserBypassCache } from '@/lib/bypass';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tokenHash: string; userId: string }> },
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { tokenHash, userId } = await params;
  if (!tokenHash || !userId) {
    return Errors.badRequest('tokenHash and userId are required');
  }

  const token = await prisma.globalBypassToken.findUnique({
    where: { token_hash: tokenHash },
  });

  if (!token) {
    return Errors.notFound('Global bypass token not found');
  }

  if (token.created_by !== auth.user.sub && auth.admin.restricted_to_faculty) {
    return Errors.forbidden('Insufficient permissions to revoke this bypass usage');
  }

  const usage = await prisma.globalBypassTokenUsage.findUnique({
    where: { token_hash_user_id: { token_hash: tokenHash, user_id: userId } },
  });

  if (!usage) {
    return Errors.notFound('Bypass usage not found');
  }
  if (usage.revoked_at) {
    return Errors.conflict('Bypass usage is already revoked');
  }

  await prisma.globalBypassTokenUsage.update({
    where: { token_hash_user_id: { token_hash: tokenHash, user_id: userId } },
    data: { revoked_at: new Date(), revoked_by: auth.admin.user_id },
  });

  await invalidateUserBypassCache(userId);

  return new NextResponse(null, { status: 204 });
}
