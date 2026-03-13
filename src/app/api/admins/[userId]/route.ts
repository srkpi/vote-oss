import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { getCachedAdmins, invalidateAdmins, invalidateInviteTokens } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isAncestorInGraph } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Hierarchy graph helpers
// ---------------------------------------------------------------------------

/**
 * Load every admin's (user_id, promoted_by) pair in a single query — including
 * soft-deleted records — and return a Map keyed by user_id.
 *
 * Soft-deleted nodes are intentionally included so that transitive chains
 * through removed intermediaries (A → B[deleted] → C) are preserved.
 * The result is only used for ancestry checks, never exposed to consumers.
 */
async function fetchHierarchyGraph(): Promise<Map<string, string | null>> {
  const nodes = await prisma.admin.findMany({
    select: { user_id: true, promoted_by: true },
  });
  return new Map(nodes.map((n) => [n.user_id, n.promoted_by]));
}

// ---------------------------------------------------------------------------
// GET /api/admins/[userId]
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { userId } = await params;
  if (!userId) return Errors.badRequest('userId is required');

  // ── Fast path: serve from cache when available ───────────────────────────
  const cached = await getCachedAdmins();
  if (cached) {
    const admin = cached.find((a) => a.user_id === userId);
    if (!admin) return Errors.notFound('Admin not found');
    return NextResponse.json(admin);
  }

  // ── Cache miss: fall through to DB ───────────────────────────────────────
  const admin = await prisma.admin.findUnique({
    where: { user_id: userId },
    select: {
      user_id: true,
      full_name: true,
      group: true,
      faculty: true,
      promoter: { select: { user_id: true, full_name: true } },
      promoted_at: true,
      manage_admins: true,
      restricted_to_faculty: true,
    },
  });

  if (!admin) return Errors.notFound('Admin not found');

  return NextResponse.json(admin);
}

// ---------------------------------------------------------------------------
// DELETE /api/admins/[userId]
// ---------------------------------------------------------------------------

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
  if (!targetAdmin || targetAdmin.deleted_at !== null) {
    return Errors.notFound('Admin not found');
  }

  // Load the full hierarchy graph in one query, then check ancestry in memory.
  const graph = await fetchHierarchyGraph();
  if (!isAncestorInGraph(graph, user.sub, targetUserId)) {
    return Errors.forbidden('You can only remove admins in your own branch of the hierarchy');
  }

  // Soft-delete the admin AND hard-delete all their invite tokens atomically.
  // Invite tokens are revoked because a deleted admin can no longer vouch for
  // new admins — keeping their tokens would be a privilege escalation bypass.
  await prisma.$transaction([
    prisma.admin.update({
      where: { user_id: targetUserId },
      data: { deleted_at: new Date(), deleted_by: user.sub },
    }),
    prisma.adminInviteToken.deleteMany({
      where: { created_by: targetUserId },
    }),
  ]);

  await Promise.all([invalidateAdmins(), invalidateInviteTokens()]);

  return NextResponse.json({ ok: true, removedUserId: targetUserId });
}
