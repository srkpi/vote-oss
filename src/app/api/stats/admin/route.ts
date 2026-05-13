import { type NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

export const revalidate = 5;

/**
 * @swagger
 * /api/stats/admin:
 *   get:
 *     summary: Admin statistics
 *     description: >
 *       Returns aggregated platform statistics for administrative dashboards.
 *       Includes counts for elections, open elections, ballots, petitions,
 *       groups, and admins. Requires admin authentication.
 *     tags:
 *       - Stats
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Admin statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 elections:
 *                   type: integer
 *                   description: Total number of active elections
 *                   example: 42
 *                 openElections:
 *                   type: integer
 *                   description: Number of currently open elections
 *                   example: 5
 *                 ballots:
 *                   type: integer
 *                   description: Total number of ballots submitted for elections
 *                   example: 1280
 *                 petitions:
 *                   type: integer
 *                   description: Total number of petitions
 *                   example: 12
 *                 groups:
 *                   type: integer
 *                   description: Total number of active groups
 *                   example: 8
 *                 admins:
 *                   type: integer
 *                   description: Total number of active administrators
 *                   example: 3
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – user is not an admin
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const now = new Date();
  const [elections, openElections, ballots, petitions, groups, admins] = await Promise.all([
    prisma.election.count({ where: { type: 'ELECTION', deleted_at: null } }),
    prisma.election.count({
      where: {
        type: 'ELECTION',
        deleted_at: null,
        opens_at: { lte: now },
        closes_at: { gt: now },
      },
    }),
    prisma.ballot.count({ where: { election: { type: 'ELECTION', deleted_at: null } } }),
    prisma.election.count({ where: { type: 'PETITION', deleted_at: null } }),
    prisma.group.count({ where: { deleted_at: null } }),
    prisma.admin.count({ where: { deleted_at: null } }),
  ]);

  return NextResponse.json({ elections, openElections, ballots, petitions, groups, admins });
}
