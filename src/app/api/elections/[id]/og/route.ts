import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCachedElections } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';

/**
 * @swagger
 * /api/elections/{id}/og:
 *   get:
 *     summary: Get election Open Graph metadata
 *     description: >
 *       Returns minimal public metadata for building Open Graph tags and link previews.
 *       This endpoint is public and does not require authentication.
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
 *       200:
 *         description: Election public metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - title
 *               properties:
 *                 title:
 *                   type: string
 *                   description: Election title
 *       400:
 *         description: Invalid UUID
 *       404:
 *         description: Election not found
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: electionId } = await params;

  if (!isValidUuid(electionId)) {
    return Errors.badRequest('Invalid election id');
  }

  const cached = await getCachedElections();
  if (cached) {
    const found = cached.find((e) => e.id === electionId);
    if (!found || found.deletedAt) return Errors.notFound('Election not found');

    return NextResponse.json({
      title: found.title,
    });
  }

  const election = await prisma.election.findUnique({
    where: { id: electionId, deleted_at: null },
    select: { title: true },
  });

  if (!election) return Errors.notFound('Election not found');

  return NextResponse.json({
    title: election.title,
  });
}
