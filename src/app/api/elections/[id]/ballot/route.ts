import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  computeNullifier,
  verifyVoteTokenSignature,
  decryptBallot,
  signBallotEntry,
  computeBallotHash,
} from '@/lib/crypto';
import { Errors } from '@/lib/errors';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const electionId = parseInt(params.id, 10);
  if (isNaN(electionId)) return Errors.badRequest('Invalid election id');

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

  // Verify vote token signature using election public key
  const signatureValid = verifyVoteTokenSignature(election.public_key, token, signature);
  if (!signatureValid) {
    return Errors.badRequest('Invalid vote token signature');
  }

  // Verify token belongs to this election
  const tokenElectionId = token.split(':')[0];
  if (parseInt(tokenElectionId, 10) !== electionId) {
    return Errors.badRequest('Vote token does not belong to this election');
  }

  // Verify nullifier = H(token)
  const expectedNullifier = computeNullifier(token);
  if (expectedNullifier !== nullifier) {
    return Errors.badRequest('Nullifier does not match token hash');
  }

  // Check nullifier not already used
  const usedNullifier = await prisma.usedTokenNullifier.findUnique({
    where: { nullifier },
  });
  if (usedNullifier) {
    return Errors.conflict('This vote token has already been used');
  }

  // Decrypt ballot and verify choice is valid
  let choiceIdStr: string;
  try {
    choiceIdStr = decryptBallot(election.private_key, encryptedBallot);
  } catch {
    return Errors.badRequest('Failed to decrypt ballot – check encryption format');
  }

  const choiceId = parseInt(choiceIdStr, 10);
  const validChoice = election.choices.find((c) => c.id === choiceId);
  if (!validChoice) {
    return Errors.badRequest('Decrypted ballot contains invalid choice');
  }

  // Get previous ballot hash for chain continuity
  const lastBallot = await prisma.ballot.findFirst({
    where: { election_id: electionId },
    orderBy: { id: 'desc' },
    select: { current_hash: true },
  });

  const previousHash = lastBallot?.current_hash ?? null;

  // Sign the ballot entry with election private key
  const ballotSignature = signBallotEntry(election.private_key, {
    electionId,
    encryptedBallot,
    previousHash,
  });

  // Compute blockchain hash
  const currentHash = computeBallotHash({
    electionId,
    encryptedBallot,
    signature: ballotSignature,
    previousHash,
  });

  // Persist nullifier + ballot atomically
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
