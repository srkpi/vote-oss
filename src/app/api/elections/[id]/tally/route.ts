import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { decryptBallot } from '@/lib/crypto';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils';

/**
 * @swagger
 * /api/elections/{id}/tally:
 *   get:
 *     summary: Get election results
 *     description: >
 *       Returns the vote tally for a closed election. If a pre-computed tally
 *       exists it is returned immediately; otherwise all ballots are decrypted,
 *       counted, and the tally is persisted for future requests. Issued tokens
 *       and nullifiers are also cleaned up on first tally computation.
 *       The election private key is included so clients can independently
 *       verify the result.
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
 *         description: Tally results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 electionId:
 *                   type: string
 *                 title:
 *                   type: string
 *                 closedAt:
 *                   type: string
 *                   format: date-time
 *                 privateKey:
 *                   type: string
 *                   description: Election private key for independent verification
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       choiceId:
 *                         type: string
 *                       choice:
 *                         type: string
 *                       position:
 *                         type: integer
 *                       votes:
 *                         type: integer
 *                 totalBallots:
 *                   type: integer
 *       400:
 *         description: Election has not closed yet or invalid UUID
 *       401:
 *         description: Unauthorized
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
    include: {
      choices: { orderBy: { position: 'asc' } },
      tallies: true,
    },
  });

  if (!election) return Errors.notFound('Election not found');

  const now = new Date();
  if (now <= election.closes_at) {
    return Errors.badRequest(
      'Election has not closed yet. Tallies are computed after the election closes.',
    );
  }

  if (election.tallies.length > 0) {
    const result = election.choices.map((c) => {
      const tally = election.tallies.find((t) => t.choice_id === c.id);
      return {
        choiceId: c.id,
        choice: c.choice,
        position: c.position,
        votes: tally?.vote_count ?? 0,
      };
    });

    return NextResponse.json({
      electionId,
      title: election.title,
      closedAt: election.closes_at,
      privateKey: election.private_key,
      results: result,
      totalBallots: result.reduce((acc, r) => acc + r.votes, 0),
    });
  }

  const ballots = await prisma.ballot.findMany({
    where: { election_id: electionId },
    select: { encrypted_ballot: true },
  });

  const tally: Record<string, number> = {};
  election.choices.forEach((c) => {
    tally[c.id] = 0;
  });

  for (const ballot of ballots) {
    try {
      const choiceId = decryptBallot(election.private_key, ballot.encrypted_ballot);
      if (choiceId in tally) {
        tally[choiceId]++;
      }
    } catch {
      console.error(`[tally] Failed to decrypt ballot for election ${electionId}`);
    }
  }

  await prisma.issuedToken.deleteMany({ where: { election_id: electionId } });
  await prisma.usedTokenNullifier.deleteMany({ where: { election_id: electionId } });
  await prisma.electionTally.createMany({
    data: Object.entries(tally).map(([choiceId, count]) => ({
      election_id: electionId,
      choice_id: choiceId,
      vote_count: count,
    })),
    skipDuplicates: true,
  });

  const result = election.choices.map((c) => ({
    choiceId: c.id,
    choice: c.choice,
    position: c.position,
    votes: tally[c.id] ?? 0,
  }));

  return NextResponse.json({
    electionId,
    title: election.title,
    closedAt: election.closes_at,
    privateKey: election.private_key,
    results: result,
    totalBallots: ballots.length,
  });
}
