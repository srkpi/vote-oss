import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { invalidateAdmins } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

async function isAncestor(ancestorId: string, targetUserId: string): Promise<boolean> {
  const visited = new Set<string>();
  let currentId: string | null = targetUserId;

  while (currentId) {
    if (visited.has(currentId)) break;
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { userId } = await params;
  if (!userId) return Errors.badRequest('userId is required');

  const admin = await prisma.admin.findUnique({
    where: { user_id: userId },
  });

  if (!admin) return Errors.notFound('Admin not found');

  return NextResponse.json(admin);
}

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
  if (!targetAdmin) return Errors.notFound('Admin not found');

  const canManage = await isAncestor(user.sub, targetUserId);
  if (!canManage) {
    return Errors.forbidden('You can only remove admins in your own branch of the hierarchy');
  }

  await prisma.admin.delete({ where: { user_id: targetUserId } });
  await invalidateAdmins();

  return NextResponse.json({ ok: true, removedUserId: targetUserId });
}
