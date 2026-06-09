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
 *     summary: Get election or petition Open Graph metadata
 *     description: >
 *       Returns minimal public metadata for building Open Graph tags and link previews.
 *       This endpoint is public and does not require authentication.
 *     tags:
 *       - Elections
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
 *         description: Election or petition public metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - title
 *                 - type
 *               properties:
 *                 title:
 *                   type: string
 *                   description: Election title
 *                 type:
 *                   $ref: '#/components/schemas/ElectionType'
 *       400:
 *         description: Invalid UUID
 *       404:
 *         description: Election or petition not found
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: electionId } = await params;

  if (!isValidUuid(electionId)) {
    return Errors.badRequest('Invalid election or petition id');
  }

  const cached = await getCachedElections();
  if (cached) {
    const found = cached.find((e) => e.id === electionId);
    if (!found || found.deletedAt) return Errors.notFound('Election or petition not found');

    return NextResponse.json({
      title: found.title,
      type: found.type,
    });
  }

  const election = await prisma.election.findUnique({
    where: { id: electionId, deleted_at: null },
    select: { title: true, type: true },
  });

  if (!election) return Errors.notFound('Election or petition not found');

  return NextResponse.json({
    title: election.title,
    type: election.type,
  });
}
