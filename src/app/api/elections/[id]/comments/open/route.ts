import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { invalidateElections } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';

/**
 * @swagger
 * /api/elections/{id}/comments/open:
 *   post:
 *     summary: Open discussion on a petition (admin, manage_petitions)
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
 *         description: Discussion opened
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DiscussionStatus'
 *       400:
 *         description: Invalid UUID, not a petition, or already open
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
  if (!election.comments_closed) return Errors.badRequest('Discussion is already open');

  await prisma.election.update({
    where: { id: electionId },
    data: {
      comments_closed: false,
      comments_closed_at: null,
      comments_closed_by: null,
      comments_closed_by_full_name: null,
    },
  });

  await invalidateElections();

  return NextResponse.json({ commentsClosed: false, commentsClosedAt: null });
}
