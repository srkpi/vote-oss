import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

export const revalidate = 5;
export const dynamic = 'force-dynamic';

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Public platform statistics
 *     description: >
 *       Returns public aggregate statistics about the platform.
 *       This endpoint is unauthenticated and intended for public dashboards
 *       or landing pages.
 *     tags:
 *       - Stats
 *     responses:
 *       200:
 *         description: Public statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 elections:
 *                   type: integer
 *                   description: Total number of elections
 *                   example: 42
 *                 ballots:
 *                   type: integer
 *                   description: Total number of ballots submitted for elections
 *                   example: 1280
 *                 petitions:
 *                   type: integer
 *                   description: Total number of petitions
 *                   example: 12
 */
export async function GET() {
  const [elections, ballots, petitions] = await Promise.all([
    prisma.election.count({ where: { type: 'ELECTION', deleted_at: null } }),
    prisma.ballot.count({ where: { election: { type: 'ELECTION', deleted_at: null } } }),
    prisma.election.count({ where: { type: 'PETITION', deleted_at: null } }),
  ]);

  return NextResponse.json({ elections, ballots, petitions });
}
