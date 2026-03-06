import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/errors';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const electionId = parseInt(params.id, 10);
  if (isNaN(electionId)) return Errors.badRequest('Invalid election id');

  const election = await prisma.election.findUnique({
    where: { id: electionId },
    include: {
      choices: { orderBy: { position: 'asc' } },
      creator: { select: { full_name: true, faculty: true } },
      _count: { select: { ballots: true } },
    },
  });

  if (!election) return Errors.notFound('Election not found');

  const { user } = auth;

  // Check user eligibility for restricted elections
  if (
    (election.restricted_to_faculty && election.restricted_to_faculty !== user.faculty) ||
    (election.restricted_to_group && election.restricted_to_group !== user.group)
  ) {
    return Errors.forbidden('You are not eligible for this election');
  }

  const now = new Date();
  const isClosed = now > election.closes_at;

  return NextResponse.json({
    id: election.id,
    title: election.title,
    createdAt: election.created_at,
    opensAt: election.opens_at,
    closesAt: election.closes_at,
    status: now < election.opens_at ? 'upcoming' : now <= election.closes_at ? 'open' : 'closed',
    restrictedToFaculty: election.restricted_to_faculty,
    restrictedToGroup: election.restricted_to_group,
    publicKey: election.public_key,
    privateKey: isClosed ? election.private_key : undefined,
    creator: election.creator,
    choices: election.choices.map((c) => ({ id: c.id, choice: c.choice, position: c.position })),
    ballotCount: election._count.ballots,
  });
}
