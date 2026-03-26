import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import {
  computeBallotHash,
  computeNullifier,
  decryptBallot,
  signBallotEntry,
  verifyVoteTokenSignature,
} from '@/lib/crypto';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils';

/**
 * @swagger
 * /api/elections/{id}/ballot:
 *   post:
 *     summary: Cast a ballot in an election
 *     description: >
 *       Submits an encrypted ballot for an open election. The endpoint
 *       verifies the vote token signature, checks that the nullifier has not
 *       been used before (replay protection), decrypts the ballot to validate
 *       the selected choice, and appends the ballot to the hash chain. Requires
 *       any authenticated user.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - signature
 *               - encryptedBallot
 *               - nullifier
 *             properties:
 *               token:
 *                 type: string
 *                 description: Vote token issued by POST /api/elections/{id}/token
 *               signature:
 *                 type: string
 *                 description: ECDSA signature of the vote token
 *               encryptedBallot:
 *                 type: string
 *                 description: RSA-encrypted choice ID
 *               nullifier:
 *                 type: string
 *                 description: SHA-256 hash of the vote token (prevents double-voting)
 *     responses:
 *       201:
 *         description: Ballot recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 ballotHash:
 *                   type: string
 *                   description: Current hash in the ballot chain for this ballot
 *       400:
 *         description: Validation error (bad UUID, invalid signature, bad nullifier, bad ballot, election not open)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Election not found
 *       409:
 *         description: This vote token has already been used
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: electionId } = await params;
  if (!isValidUuid(electionId)) return Errors.badRequest('Invalid election id');

  let body: {
    token?: string;
    signature?: string;
    encryptedBallot?: string;
    nullifier?: string;
  };

  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { token, signature, encryptedBallot, nullifier } = body;

  if (!token || !signature || !encryptedBallot || !nullifier) {
    return Errors.badRequest('token, signature, encryptedBallot, nullifier are required');
  }

  const now = new Date();

  const election = await prisma.election.findUnique({
    where: { id: electionId },
    include: { choices: true },
  });

  if (!election) return Errors.notFound('Election not found');

  if (now < election.opens_at) return Errors.badRequest('Election has not started yet');
  if (now > election.closes_at) return Errors.badRequest('Election has already closed');

  if (!verifyVoteTokenSignature(election.public_key, token, signature)) {
    return Errors.badRequest('Invalid vote token signature');
  }

  const tokenElectionId = token.slice(0, token.indexOf(':'));
  if (tokenElectionId !== electionId) {
    return Errors.badRequest('Vote token does not belong to this election');
  }

  const expectedNullifier = computeNullifier(token);
  if (expectedNullifier !== nullifier) {
    return Errors.badRequest('Nullifier does not match token hash');
  }

  const usedNullifier = await prisma.usedTokenNullifier.findUnique({
    where: { nullifier, election_id: electionId },
  });
  if (usedNullifier) return Errors.conflict('This vote token has already been used');

  let choiceIds: string[];
  try {
    choiceIds = decryptBallot(election.private_key, encryptedBallot);
  } catch {
    return Errors.badRequest('Failed to decrypt ballot – check encryption format');
  }

  if (choiceIds.length < election.min_choices || choiceIds.length > election.max_choices) {
    return Errors.badRequest(
      `Must select between ${election.min_choices} and ${election.max_choices} choices`,
    );
  }
  if (new Set(choiceIds).size !== choiceIds.length) {
    return Errors.badRequest('Duplicate choices are not allowed');
  }
  for (const choiceId of choiceIds) {
    if (!election.choices.find((c) => c.id === choiceId)) {
      return Errors.badRequest('Decrypted ballot contains invalid choice');
    }
  }

  const lastBallot = await prisma.ballot.findFirst({
    where: { election_id: electionId },
    orderBy: { created_at: 'desc' },
    select: { current_hash: true },
  });

  const previousHash = lastBallot?.current_hash ?? null;

  const ballotSignature = signBallotEntry(election.private_key, {
    electionId,
    encryptedBallot,
    previousHash,
  });

  const currentHash = computeBallotHash({
    electionId,
    encryptedBallot,
    signature: ballotSignature,
    previousHash,
  });

  await prisma.$transaction([
    prisma.usedTokenNullifier.create({
      data: { nullifier, election_id: electionId },
    }),
    prisma.ballot.create({
      data: {
        election_id: electionId,
        encrypted_ballot: encryptedBallot,
        created_at: new Date(),
        signature: ballotSignature,
        previous_hash: previousHash,
        current_hash: currentHash,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, ballotHash: currentHash }, { status: 201 });
}
