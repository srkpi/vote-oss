import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { getCachedAdmins, invalidateElections } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { adminCanRestoreElection } from '@/lib/restrictions';
import { isValidUuid } from '@/lib/utils/common';
import type { ElectionRestriction } from '@/types/election';

/**
 * Build a userId → promoted_by map from the cached admin list or the DB.
 */
async function buildAdminGraph(): Promise<Map<string, string | null>> {
  const cachedAdmins = await getCachedAdmins();
  if (cachedAdmins) {
    return new Map(cachedAdmins.map((a) => [a.userId, a.promoter?.userId ?? null]));
  }
  const dbAdmins = await prisma.admin.findMany({
    where: { deleted_at: null },
    select: { user_id: true, promoted_by: true },
  });
  return new Map(dbAdmins.map((a) => [a.user_id, a.promoted_by]));
}

/**
 * @swagger
 * /api/elections/{id}/restore:
 *   post:
 *     summary: Restore a soft-deleted election
 *     description: >
 *       Clears the deleted_at and deleted_by fields, making the election
 *       visible to users again. Requires admin authentication.
 *       Admins may restore a deleted election only if they deleted it themselves
 *       or are an ancestor in the admin hierarchy of the admin who deleted it.
 *     tags:
 *       - Elections
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Election UUID
 *     responses:
 *       204:
 *         description: Election restored
 *       400:
 *         description: Invalid UUID or election is not deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – not an admin or insufficient hierarchy
 *       404:
 *         description: Election not found
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { id: electionId } = await params;
  if (!isValidUuid(electionId)) return Errors.badRequest('Invalid election id');

  const { admin } = auth;

  const election = await prisma.election.findUnique({
    where: { id: electionId },
    include: { restrictions: { select: { type: true, value: true } } },
  });
  if (!election) return Errors.notFound('Election not found');

  if (!election.deleted_at) {
    return Errors.badRequest('Election is not deleted');
  }

  const restrictions = election.restrictions as ElectionRestriction[];
  const adminGraph = await buildAdminGraph();

  if (
    !adminCanRestoreElection(
      {
        restricted_to_faculty: admin.restricted_to_faculty,
        faculty: admin.faculty,
        user_id: admin.user_id,
      },
      { restrictions, deletedByUserId: election.deleted_by },
      adminGraph,
    )
  ) {
    return Errors.forbidden(
      'You can only restore elections that you deleted or that were deleted by your subordinates within your faculty',
    );
  }

  await prisma.election.update({
    where: { id: electionId },
    data: { deleted_at: null, deleted_by: null },
  });

  await invalidateElections();

  return new NextResponse(null, { status: 204 });
}
