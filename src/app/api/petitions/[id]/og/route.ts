import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCachedElections } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';

/**
 * @swagger
 * /api/petitions/{id}/og:
 *   get:
 *     summary: Get petition Open Graph metadata
 *     description: >
 *       Returns minimal public metadata for building Open Graph tags and link
 *       previews for a petition.  Public — no authentication required.
 *       Returns 404 when the id refers to a non-petition election.
 *     tags:
 *       - Elections
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Petition UUID
 *     responses:
 *       200:
 *         description: Petition public metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - title
 *               properties:
 *                 title:
 *                   type: string
 *       400:
 *         description: Invalid UUID
 *       404:
 *         description: Petition not found
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isValidUuid(id)) {
    return Errors.badRequest('Invalid petition id');
  }

  const cached = await getCachedElections();
  if (cached) {
    const found = cached.find((e) => e.id === id);
    if (!found || found.deletedAt || found.type !== 'PETITION') {
      return Errors.notFound('Petition not found');
    }
    return NextResponse.json({ title: found.title });
  }

  const petition = await prisma.election.findUnique({
    where: { id, deleted_at: null, type: 'PETITION' },
    select: { title: true },
  });

  if (!petition) return Errors.notFound('Petition not found');

  return NextResponse.json({ title: petition.title });
}
