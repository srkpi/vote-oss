import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { getCachedAdmins, invalidateAdmins, invalidateInviteTokens } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { isAncestorInGraph } from '@/lib/graph';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { user, admin } = auth;
  const currentAdminId = user.sub;

  let body: { replacementId?: string | null };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { replacementId = null } = body;

  // Load all active admins — from cache when available, otherwise from DB.
  // Since soft-deleted admins are guaranteed to have no children, active-only
  // nodes are sufficient for all hierarchy checks and subordinate lookups.
  const cachedAdmins = await getCachedAdmins();

  type ActiveAdmin = { user_id: string; promoted_by: string | null };

  const activeAdmins: ActiveAdmin[] = cachedAdmins
    ? cachedAdmins.map((a) => ({ user_id: a.userId, promoted_by: a.promoter?.userId ?? null }))
    : await prisma.admin.findMany({
        where: { deleted_at: null },
        select: { user_id: true, promoted_by: true },
      });

  // The last admin on the platform cannot leave
  if (activeAdmins.length === 1) {
    return Errors.badRequest('You are the only admin on the platform and cannot leave');
  }

  const directChildren = activeAdmins.filter((a) => a.promoted_by === currentAdminId);

  // Admin has subordinates — a replacement must be named
  if (directChildren.length > 0 && !replacementId) {
    return Errors.badRequest(
      'You have subordinates. Specify a replacement admin to take your place before leaving',
    );
  }

  const now = new Date();

  if (!replacementId) {
    // No subordinates — plain self-soft-delete
    await prisma.$transaction([
      prisma.admin.update({
        where: { user_id: currentAdminId },
        data: { deleted_at: now, deleted_by: currentAdminId },
      }),
      prisma.adminInviteToken.deleteMany({ where: { created_by: currentAdminId } }),
    ]);
  } else {
    const replacement = activeAdmins.find((a) => a.user_id === replacementId);
    if (!replacement) {
      return Errors.notFound('Replacement admin not found or is no longer active');
    }

    // Replacement must be within the caller's subtree
    const graph = new Map(activeAdmins.map((a) => [a.user_id, a.promoted_by]));
    if (!isAncestorInGraph(graph, currentAdminId, replacementId)) {
      return Errors.badRequest('The replacement admin must be within your hierarchy branch');
    }

    const isDirectChild = replacement.promoted_by === currentAdminId;

    const callerNode = activeAdmins.find((a) => a.user_id === currentAdminId);
    const callerPromotedBy = callerNode ? callerNode.promoted_by : null;

    if (isDirectChild) {
      // ── Direct-child case ─────────────────────────────────────────────────
      // The chosen child takes the caller's exact position:
      //   1. All other direct children → re-parented to the replacement
      //   2. Replacement promoted_by ← caller's promoted_by (moves up)
      //   3. Caller is soft-deleted
      await prisma.$transaction([
        prisma.admin.updateMany({
          where: { promoted_by: currentAdminId, user_id: { not: replacementId } },
          data: { promoted_by: replacementId },
        }),
        prisma.admin.update({
          where: { user_id: replacementId },
          data: {
            promoted_by: callerPromotedBy,
            manage_admins: admin.manage_admins,
            restricted_to_faculty: admin.restricted_to_faculty,
          },
        }),
        prisma.admin.update({
          where: { user_id: currentAdminId },
          data: { deleted_at: now, deleted_by: currentAdminId },
        }),
        prisma.adminInviteToken.deleteMany({ where: { created_by: currentAdminId } }),
      ]);
    } else {
      // ── Indirect-child case ───────────────────────────────────────────────
      // The chosen descendant is extracted from deeper in the tree and placed
      // at the caller's position:
      //   1. Replacement's own direct children → re-parented to replacement's
      //      current parent (fills the gap left by extracting it)
      //   2. All caller's direct children → re-parented to the replacement
      //   3. Replacement promoted_by ← caller's promoted_by (moves up)
      //   4. Caller is soft-deleted
      await prisma.$transaction([
        prisma.admin.updateMany({
          where: { promoted_by: replacementId },
          data: { promoted_by: replacement.promoted_by },
        }),
        prisma.admin.updateMany({
          where: { promoted_by: currentAdminId },
          data: { promoted_by: replacementId },
        }),
        prisma.admin.update({
          where: { user_id: replacementId },
          data: {
            promoted_by: callerPromotedBy,
            manage_admins: admin.manage_admins,
            restricted_to_faculty: admin.restricted_to_faculty,
          },
        }),
        prisma.admin.update({
          where: { user_id: currentAdminId },
          data: { deleted_at: now, deleted_by: currentAdminId },
        }),
        prisma.adminInviteToken.deleteMany({ where: { created_by: currentAdminId } }),
      ]);
    }
  }

  await Promise.all([invalidateAdmins(), invalidateInviteTokens()]);

  return new NextResponse(null, { status: 204 });
}
