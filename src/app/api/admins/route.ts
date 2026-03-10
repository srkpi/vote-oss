import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/errors';

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

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { user } = auth;

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

  const deletableIds = computeDeletableIds(admins, user.sub);

  return NextResponse.json(
    admins.map((admin) => ({
      ...admin,
      deletable: deletableIds.has(admin.user_id),
    })),
  );
}
