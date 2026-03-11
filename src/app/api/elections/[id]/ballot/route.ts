import { NextRequest, NextResponse } from 'next/server';

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

  const signatureValid = verifyVoteTokenSignature(election.public_key, token, signature);
  if (!signatureValid) return Errors.badRequest('Invalid vote token signature');

  const tokenElectionId = token.slice(0, token.indexOf(':'));
  if (tokenElectionId !== electionId) {
    return Errors.badRequest('Vote token does not belong to this election');
  }

  const expectedNullifier = computeNullifier(token);
  if (expectedNullifier !== nullifier) {
    return Errors.badRequest('Nullifier does not match token hash');
  }

  const usedNullifier = await prisma.usedTokenNullifier.findUnique({ where: { nullifier } });
  if (usedNullifier) return Errors.conflict('This vote token has already been used');

  let choiceId: string;
  try {
    choiceId = decryptBallot(election.private_key, encryptedBallot);
  } catch {
    return Errors.badRequest('Failed to decrypt ballot – check encryption format');
  }

  const validChoice = election.choices.find((c) => c.id === choiceId);
  if (!validChoice) return Errors.badRequest('Decrypted ballot contains invalid choice');

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
