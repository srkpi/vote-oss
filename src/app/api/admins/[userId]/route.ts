import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/errors';

// Walks up the promoted_by chain of `target` to see if `ancestorId` is an ancestor
async function isAncestor(ancestorId: string, targetUserId: string): Promise<boolean> {
  const visited = new Set<string>();
  let currentId: string | null = targetUserId;

  while (currentId) {
    if (visited.has(currentId)) break; // cycle guard
    visited.add(currentId);

    const node: { promoted_by: string | null } | null = await prisma.admin.findUnique({
      where: { user_id: currentId },
      select: { promoted_by: true },
    });

    if (!node) break;
    if (node.promoted_by === ancestorId) return true;
    currentId = node.promoted_by;
  }

  return false;
}

export async function DELETE(req: NextRequest, { params }: { params: { userId: string } }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { admin, user } = auth;

  if (!admin?.manage_admins) {
    return Errors.forbidden('You do not have permission to remove admins');
  }

  const targetUserId = params.userId;
  if (!targetUserId) return Errors.badRequest('userId is required');
  if (targetUserId === user.sub) return Errors.badRequest('You cannot remove yourself');

  const targetAdmin = await prisma.admin.findUnique({ where: { user_id: targetUserId } });
  if (!targetAdmin) return Errors.notFound('Admin not found');

  // Verify the requesting admin is an ancestor of the target
  const canManage = await isAncestor(user.sub, targetUserId);
  if (!canManage) {
    return Errors.forbidden('You can only remove admins in your own branch of the hierarchy');
  }

  await prisma.admin.delete({ where: { user_id: targetUserId } });

  return NextResponse.json({ ok: true, removedUserId: targetUserId });
}
