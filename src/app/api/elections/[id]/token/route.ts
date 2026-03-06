import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateVoteToken, signVoteToken } from '@/lib/crypto';
import { Errors } from '@/lib/errors';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const electionId = parseInt(params.id, 10);
  if (isNaN(electionId)) return Errors.badRequest('Invalid election id');

  const { user } = auth;
  const now = new Date();

  const election = await prisma.election.findUnique({
    where: { id: electionId },
  });

  if (!election) return Errors.notFound('Election not found');

  // Check election is open
  if (now < election.opens_at) {
    return Errors.badRequest('Election has not started yet');
  }
  if (now > election.closes_at) {
    return Errors.badRequest('Election has already closed');
  }

  // Check user eligibility
  if (election.restricted_to_faculty && election.restricted_to_faculty !== user.faculty) {
    return Errors.forbidden('You are not eligible for this election (faculty restriction)');
  }
  if (election.restricted_to_group && election.restricted_to_group !== user.group) {
    return Errors.forbidden('You are not eligible for this election (group restriction)');
  }

  // Check token not already issued
  const existingToken = await prisma.issuedToken.findUnique({
    where: { election_id_user_id: { election_id: electionId, user_id: user.sub } },
  });
  if (existingToken) {
    return Errors.conflict('Vote token already issued for this election');
  }

  // Generate and sign vote token
  const { token } = generateVoteToken(electionId);
  const signature = signVoteToken(election.private_key, token);

  // Record issuance atomically
  await prisma.issuedToken.create({
    data: { election_id: electionId, user_id: user.sub },
  });

  return NextResponse.json({ token, signature }, { status: 200 });
}
