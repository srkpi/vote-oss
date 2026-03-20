import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils';

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
      restricted_to_faculty: true,
      restricted_to_group: true,
    },
  });

  if (!election) return Errors.notFound('Election not found');

  // ── Access control ────────────────────────────────────────────────────────
  const { user } = auth;

  if (user.is_admin && !user.restricted_to_faculty) {
    // Unrestricted admin can view ballots for any election
  } else if (user.is_admin && user.restricted_to_faculty) {
    if (election.restricted_to_faculty && election.restricted_to_faculty !== user.faculty) {
      return Errors.forbidden('You are not eligible to view this election');
    }
  } else {
    if (
      (election.restricted_to_faculty && election.restricted_to_faculty !== user.faculty) ||
      (election.restricted_to_group && election.restricted_to_group !== user.group)
    ) {
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
