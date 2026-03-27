import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { adminCanAccessElection, checkRestrictions } from '@/lib/restrictions';
import { isValidUuid } from '@/lib/utils';
import type { ElectionRestriction } from '@/types/election';

/**
 * @swagger
 * /api/elections/{id}/ballots:
 *   get:
 *     summary: List all ballots for an election
 *     description: >
 *       Returns the full ordered ballot chain for the given election.
 *       Access is subject to faculty/group eligibility rules identical to
 *       those applied when viewing the election itself. The encrypted ballot
 *       payload and chain hashes are included so clients can independently
 *       verify integrity.
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
 *         description: Election metadata and ballot list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 election:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     title:
 *                       type: string
 *                 ballots:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       encryptedBallot:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       signature:
 *                         type: string
 *                       previousHash:
 *                         type: string
 *                         nullable: true
 *                       currentHash:
 *                         type: string
 *                 total:
 *                   type: integer
 *       400:
 *         description: Invalid election UUID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User is not eligible to view this election
 *       404:
 *         description: Election not found
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: electionId } = await params;
  if (!isValidUuid(electionId)) return Errors.badRequest('Invalid election id');

  const election = await prisma.election.findUnique({
    where: { id: electionId },
    select: {
      id: true,
      title: true,
      opens_at: true,
      closes_at: true,
      restrictions: { select: { type: true, value: true } },
    },
  });

  if (!election) return Errors.notFound('Election not found');

  const { user } = auth;
  const restrictions = election.restrictions as ElectionRestriction[];

  if (user.isAdmin && !user.restrictedToFaculty) {
    // pass
  } else if (user.isAdmin && user.restrictedToFaculty) {
    if (!adminCanAccessElection(user.faculty, restrictions)) {
      return Errors.forbidden('You are not eligible to view this election');
    }
  } else {
    if (!checkRestrictions(restrictions, user)) {
      return Errors.forbidden('You are not eligible to view this election');
    }
  }

  const ballots = await prisma.ballot.findMany({
    where: { election_id: electionId },
    select: {
      id: true,
      encrypted_ballot: true,
      created_at: true,
      signature: true,
      previous_hash: true,
      current_hash: true,
    },
    orderBy: { created_at: 'asc' },
  });

  return NextResponse.json({
    election: { id: election.id, title: election.title },
    ballots: ballots.map((b) => ({
      id: b.id,
      encryptedBallot: b.encrypted_ballot,
      createdAt: b.created_at.toISOString(),
      signature: b.signature,
      previousHash: b.previous_hash,
      currentHash: b.current_hash,
    })),
    total: ballots.length,
  });
}
