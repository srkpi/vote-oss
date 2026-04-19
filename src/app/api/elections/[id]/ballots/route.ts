import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { getCachedElections } from '@/lib/cache';
import { decryptField } from '@/lib/encryption';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { adminCanAccessElection, checkRestrictions } from '@/lib/restrictions';
import { isValidUuid } from '@/lib/utils/common';
import { shuffleChoicesForUser } from '@/lib/utils/shuffle-choices';
import type { ElectionRestriction } from '@/types/election';

/**
 * @swagger
 * /api/elections/{id}/ballots:
 *   get:
 *     summary: List all ballots for an election
 *     description: >
 *       Returns the full ordered ballot chain for the given election together
 *       with complete election metadata (status, choices, ballot count, and —
 *       for closed elections — the private key for client-side decryption).
 *       This single request replaces the previous pattern of fetching ballots
 *       and election detail separately. Access is subject to faculty/group
 *       eligibility rules identical to those applied when viewing the election.
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
 *                   $ref: '#/components/schemas/ElectionForBallotsResponse'
 *                 ballots:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Ballot'
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

  let electionData;
  const cached = await getCachedElections();
  if (cached) {
    const found = cached.find((e) => e.id === electionId);
    if (!found) return Errors.notFound('Election not found');

    electionData = {
      id: found.id,
      title: found.title,
      opens_at: new Date(found.opensAt),
      closes_at: new Date(found.closesAt),
      private_key: found.privateKey,
      deleted_at: found.deletedAt,
      restrictions: found.restrictions as ElectionRestriction[],
      choices: found.choices,
      min_choices: found.minChoices,
      max_choices: found.maxChoices,
      shuffle_choices: found.shuffleChoices ?? false,
    };
  } else {
    const dbElection = await prisma.election.findUnique({
      where: { id: electionId },
      select: {
        id: true,
        title: true,
        opens_at: true,
        closes_at: true,
        private_key: true,
        deleted_at: true,
        shuffle_choices: true,
        restrictions: { select: { type: true, value: true } },
        choices: {
          select: { id: true, choice: true, position: true },
          orderBy: { position: 'asc' },
        },
        min_choices: true,
        max_choices: true,
      },
    });

    if (!dbElection) return Errors.notFound('Election not found');

    electionData = {
      ...dbElection,
      restrictions: dbElection.restrictions as ElectionRestriction[],
    };
  }

  const { user } = auth;
  if (!user.isAdmin && electionData.deleted_at) return Errors.notFound('Election not found');

  const restrictions = electionData.restrictions as ElectionRestriction[];

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

  const now = new Date();
  const isClosed = now > electionData.closes_at;
  const status =
    now < electionData.opens_at ? 'upcoming' : now <= electionData.closes_at ? 'open' : 'closed';

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

  let choices = electionData.choices.map((c) => ({
    id: c.id,
    choice: c.choice,
    position: c.position,
  }));

  if (electionData.shuffle_choices) {
    choices = shuffleChoicesForUser(choices, user.sub, electionId);
  }

  return NextResponse.json({
    election: {
      id: electionData.id,
      title: electionData.title,
      status,
      ballotCount: ballots.length,
      deletedAt: electionData.deleted_at,
      shuffleChoices: electionData.shuffle_choices,
      choices,
      minChoices: electionData.min_choices,
      maxChoices: electionData.max_choices,
      ...(isClosed && { privateKey: decryptField(electionData.private_key) }),
    },
    ballots: ballots.map((b) => ({
      id: b.id,
      encryptedBallot: b.encrypted_ballot,
      createdAt: b.created_at.toISOString(),
      signature: b.signature,
      previousHash: b.previous_hash,
      currentHash: b.current_hash,
    })),
  });
}
