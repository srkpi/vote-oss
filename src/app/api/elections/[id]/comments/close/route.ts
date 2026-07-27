import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { invalidateElections } from '@/lib/cache';
import { encryptField } from '@/lib/encryption';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';

/**
 * @swagger
 * /api/elections/{id}/comments/close:
 *   post:
 *     summary: Close discussion on a petition (admin, manage_petitions)
 *     description: >
 *       Blocks new comments and edits to existing ones. Existing comments
 *       stay visible, can still be deleted (by their author or an admin),
 *       and votes on them can still be cast, changed, or revoked.
 *     tags:
 *       - Petition comments
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Discussion closed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DiscussionStatus'
 *       400:
 *         description: Invalid UUID, not a petition, or already closed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin lacks manage_petitions
 *       404:
 *         description: Petition not found
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);
  if (!auth.admin.manage_petitions) return Errors.forbidden('Requires manage_petitions');

  const { id: electionId } = await params;
  if (!isValidUuid(electionId)) return Errors.badRequest('Invalid election id');

  const election = await prisma.election.findUnique({
    where: { id: electionId },
    select: { type: true, deleted_at: true, comments_closed: true },
  });
  if (!election || election.deleted_at) return Errors.notFound('Petition not found');
  if (election.type !== 'PETITION') return Errors.badRequest('Only available for petitions');
  if (election.comments_closed) return Errors.badRequest('Discussion is already closed');

  const updated = await prisma.election.update({
    where: { id: electionId },
    data: {
      comments_closed: true,
      comments_closed_at: new Date(),
      comments_closed_by: auth.user.sub,
      comments_closed_by_full_name: encryptField(auth.user.fullName),
    },
    select: { comments_closed: true, comments_closed_at: true },
  });

  await invalidateElections();

  return NextResponse.json({
    commentsClosed: updated.comments_closed,
    commentsClosedAt: updated.comments_closed_at?.toISOString() ?? null,
  });
}
