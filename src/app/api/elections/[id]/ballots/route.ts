import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/errors';

// Public transparency endpoint – anyone authenticated can read all encrypted ballots
// to verify their own vote is included and no ballots have been removed
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const electionId = parseInt(params.id, 10);
  if (isNaN(electionId)) return Errors.badRequest('Invalid election id');

  const election = await prisma.election.findUnique({
    where: { id: electionId },
    select: { id: true, title: true, opens_at: true, closes_at: true },
  });

  if (!election) return Errors.notFound('Election not found');

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '50', 10)),
  );

  const [ballots, total] = await Promise.all([
    prisma.ballot.findMany({
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
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ballot.count({ where: { election_id: electionId } }),
  ]);

  return NextResponse.json({
    election: { id: election.id, title: election.title },
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    ballots,
  });
}
