import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { incrementLiveElectionBallotCount, setLiveElectionBallotCount } from '@/lib/cache';
import {
  computeBallotHash,
  computeNullifier,
  decryptBallot,
  signBallotEntry,
  verifyVoteTokenSignature,
} from '@/lib/crypto';
import { decryptField } from '@/lib/encryption';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';

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
    where: { id: electionId, deleted_at: null },
    include: { choices: true },
  });

  if (!election) return Errors.notFound('Election not found');

  if (now < election.opens_at) return Errors.badRequest('Election has not started yet');
  if (now > election.closes_at) return Errors.badRequest('Election has already closed');

  const privateKeyPem = decryptField(election.private_key);

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

  let decryptResult: ReturnType<typeof decryptBallot>;
  try {
    decryptResult = decryptBallot(privateKeyPem, encryptedBallot);
  } catch {
    return Errors.badRequest('Failed to decrypt ballot – check encryption format');
  }

  const { choiceIds, voter } = decryptResult;

  // ── Non-anonymous election: validate embedded voter identity ──────────────
  // The token endpoint included voterIdentity so the client could embed it in
  // the v2 envelope.  We now verify the embedded identity matches the
  // authenticated caller, preventing impersonation.
  if (!election.anonymous) {
    if (!voter) {
      return Errors.badRequest(
        'This election requires identified ballots (v2 format). ' +
          'Submit a ballot that includes voter identity.',
      );
    }
    if (voter.userId !== auth.user.sub) {
      return Errors.badRequest(
        'Voter identity embedded in the ballot does not match the authenticated user. ' +
          'Use the identity returned by the token endpoint.',
      );
    }
  }

  // ── Choice validation ─────────────────────────────────────────────────────
  if (choiceIds.length < election.min_choices || choiceIds.length > election.max_choices) {
    return Errors.badRequest(
      `Must select between ${election.min_choices} and ${election.max_choices} choices`,
    );
  }
  if (new Set(choiceIds).size !== choiceIds.length) {
    return Errors.badRequest('Duplicate choices are not allowed');
  }
  for (const choiceId of choiceIds) {
    if (!election.choices.find((c: { id: string }) => c.id === choiceId)) {
      return Errors.badRequest('Decrypted ballot contains invalid choice');
    }
  }

  // ── Append to hash chain ──────────────────────────────────────────────────
  const lastBallot = await prisma.ballot.findFirst({
    where: { election_id: electionId },
    orderBy: { created_at: 'desc' },
    select: { current_hash: true },
  });

  const previousHash = lastBallot?.current_hash ?? null;
  const ballotSignature = signBallotEntry(privateKeyPem, {
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

  // ── Update real-time vote count cache ─────────────────────────────────────
  // We INCR the per-election counter instead of invalidating the whole elections
  // cache.  This keeps the metadata cache warm while still serving live counts.
  //
  // If INCR returns 1 the counter key didn't exist (expired) — we correct the
  // value by querying the actual ballot count from the DB and overwriting.
  const newCountFromIncr = await incrementLiveElectionBallotCount(electionId);
  if (newCountFromIncr === 1) {
    // Counter was just created at 1; likely wrong — resync from DB.
    const actualCount = await prisma.ballot.count({ where: { election_id: electionId } });
    await setLiveElectionBallotCount(electionId, actualCount);
  }

  return NextResponse.json({ ballotHash: currentHash }, { status: 201 });
}
