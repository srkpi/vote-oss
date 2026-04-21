import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { Errors } from '@/lib/errors';
import { GroupNotFoundError } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';

/**
 * @swagger
 * /api/groups/{id}/og:
 *   get:
 *     summary: Get group Open Graph metadata
 *     description: >
 *       Returns minimal public metadata for building Open Graph tags and link previews.
 *       This endpoint is public and does not require authentication.
 *     tags:
 *       - Groups
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Group UUID
 *     responses:
 *       200:
 *         description: Group public metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - name
 *               properties:
 *                 name:
 *                   type: string
 *                   description: Group name
 *       400:
 *         description: Invalid UUID
 *       404:
 *         description: Group not found
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid group id');

  const group = await prisma.group.findUnique({
    where: { id, deleted_at: null },
    select: {
      name: true,
    },
  });

  if (!group) return Errors.notFound(new GroupNotFoundError().message);

  return NextResponse.json({ name: group.name });
}
