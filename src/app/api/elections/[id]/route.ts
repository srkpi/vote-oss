import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin, requireAuth } from '@/lib/auth';
import { invalidateElections } from '@/lib/cache';
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
    include: {
      choices: { orderBy: { position: 'asc' } },
      creator: { select: { full_name: true, faculty: true } },
      _count: { select: { ballots: true } },
    },
  });

  if (!election) return Errors.notFound('Election not found');

  const { user } = auth;

  // ── Access control ────────────────────────────────────────────────────────
  // Unrestricted admins may view any election.
  // Faculty-restricted admins may view global elections + their own faculty.
  // Regular users must match both faculty and group restrictions.
  if (user.is_admin && !user.restricted_to_faculty) {
    // Unrestricted admin — no restriction check needed
  } else if (user.is_admin && user.restricted_to_faculty) {
    if (election.restricted_to_faculty && election.restricted_to_faculty !== user.faculty) {
      return Errors.forbidden('You are not eligible for this election');
    }
  } else {
    if (
      (election.restricted_to_faculty && election.restricted_to_faculty !== user.faculty) ||
      (election.restricted_to_group && election.restricted_to_group !== user.group)
    ) {
      return Errors.forbidden('You are not eligible for this election');
    }
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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { id: electionId } = await params;
  if (!isValidUuid(electionId)) return Errors.badRequest('Invalid election id');

  const { admin } = auth;

  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election) return Errors.notFound('Election not found');

  // Faculty-restricted admins may only delete elections scoped to their own faculty
  if (admin.restricted_to_faculty && election.restricted_to_faculty !== admin.faculty) {
    return Errors.forbidden('You can only delete elections of your own faculty');
  }

  await prisma.election.delete({ where: { id: electionId } });
  await invalidateElections();

  return NextResponse.json({ ok: true, deletedId: electionId });
}
