import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  const electionId = parseInt(id, 10);
  if (isNaN(electionId)) return Errors.badRequest('Invalid election id');

  const election = await prisma.election.findUnique({
    where: { id: electionId },
    select: { id: true, title: true, opens_at: true, closes_at: true },
  });

  if (!election) return Errors.notFound('Election not found');

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
    orderBy: { id: 'asc' },
  });

  return NextResponse.json({
    election: { id: election.id, title: election.title },
    ballots,
    total: ballots.length,
  });
}
