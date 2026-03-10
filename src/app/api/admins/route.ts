import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { getCachedAdmins, setCachedAdmins } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Helper: compute the set of admin IDs that `currentUserId` may delete.
// An admin is deletable if it was (transitively) promoted by the current user.
// ---------------------------------------------------------------------------
function computeDeletableIds(
  admins: { user_id: string; promoted_by: string | null }[],
  currentUserId: string,
): Set<string> {
  const deletable = new Set<string>();
  let changed = true;

  while (changed) {
    changed = false;
    for (const admin of admins) {
      if (deletable.has(admin.user_id)) continue;

      const directlyPromotedByCurrent = admin.promoted_by === currentUserId;
      const promoterIsAlreadyDeletable =
        admin.promoted_by !== null && deletable.has(admin.promoted_by);

      if (directlyPromotedByCurrent || promoterIsAlreadyDeletable) {
        deletable.add(admin.user_id);
        changed = true;
      }
    }
  }

  return deletable;
}

// ---------------------------------------------------------------------------
// GET /api/admins
// Served from a 30-second Redis cache (invalidated on mutations).
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { user } = auth;

  const cached = await getCachedAdmins();
  if (cached) {
    const deletableIds = computeDeletableIds(cached, user.sub);
    return NextResponse.json(
      cached.map((admin) => ({ ...admin, deletable: deletableIds.has(admin.user_id) })),
    );
  }

  const admins = await prisma.admin.findMany({
    select: {
      user_id: true,
      full_name: true,
      group: true,
      faculty: true,
      promoted_by: true,
      promoted_at: true,
      manage_admins: true,
      restricted_to_faculty: true,
    },
    orderBy: { promoted_at: 'asc' },
  });

  // ── Populate cache (best-effort) ──────────────────────────────────────
  // Cast is safe: the selected fields match what getCachedAdmins returns.
  await setCachedAdmins(admins as Parameters<typeof setCachedAdmins>[0]);

  const deletableIds = computeDeletableIds(admins, user.sub);

  return NextResponse.json(
    admins.map((admin) => ({
      ...admin,
      deletable: deletableIds.has(admin.user_id),
    })),
  );
}
