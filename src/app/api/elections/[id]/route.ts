import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin, requireAuth } from '@/lib/auth';
import { invalidateElections } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import {
  adminCanAccessElection,
  adminCanDeleteElection,
  checkRestrictions,
} from '@/lib/restrictions';
import { isValidUuid } from '@/lib/utils';
import type { ElectionRestriction } from '@/types/election';

/**
 * @swagger
 * /api/elections/{id}:
 *   get:
 *     summary: Get a single election
 *     description: >
 *       Returns full election details including choices and ballot count.
 *       Access is subject to faculty/group eligibility. The private key is
 *       only included after the election has closed. For open elections a
 *       `hasVoted` flag indicates whether the caller has already been issued
 *       a vote token.
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
 *     responses:
 *       200:
 *         description: Election details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ElectionDetail'
 *       400:
 *         description: Invalid UUID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User is not eligible for this election
 *       404:
 *         description: Election not found
 */
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
      restrictions: { select: { type: true, value: true } },
      _count: { select: { ballots: true } },
    },
  });

  if (!election) return Errors.notFound('Election not found');

  const { user } = auth;
  const restrictions = election.restrictions as ElectionRestriction[];

  if (user.isAdmin && !user.restrictedToFaculty) {
    // unrestricted admin – pass
  } else if (user.isAdmin && user.restrictedToFaculty) {
    if (!adminCanAccessElection(user.faculty, restrictions)) {
      return Errors.forbidden('You are not eligible for this election');
    }
  } else {
    if (!checkRestrictions(restrictions, user)) {
      return Errors.forbidden('You are not eligible for this election');
    }
  }

  const now = new Date();
  const isClosed = now > election.closes_at;
  const isOpen = now >= election.opens_at && now <= election.closes_at;

  let hasVoted: boolean | undefined;
  if (isOpen) {
    const issuedToken = await prisma.issuedToken.findUnique({
      where: { election_id_user_id: { election_id: electionId, user_id: user.sub } },
    });
    hasVoted = issuedToken !== null;
  }

  return NextResponse.json({
    id: election.id,
    title: election.title,
    createdAt: election.created_at,
    opensAt: election.opens_at,
    closesAt: election.closes_at,
    status: now < election.opens_at ? 'upcoming' : now <= election.closes_at ? 'open' : 'closed',
    restrictions,
    minChoices: election.min_choices,
    maxChoices: election.max_choices,
    publicKey: election.public_key,
    privateKey: isClosed ? election.private_key : undefined,
    creator: { fullName: election.creator.full_name, faculty: election.creator.faculty },
    choices: election.choices.map((c) => ({ id: c.id, choice: c.choice, position: c.position })),
    ballotCount: election._count.ballots,
    hasVoted,
  });
}

/**
 * @swagger
 * /api/elections/{id}:
 *   delete:
 *     summary: Delete an election
 *     description: >
 *       Permanently deletes an election and all related data. Requires admin
 *       authentication. Faculty-restricted admins may only delete elections
 *       scoped to their own faculty.
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
 *     responses:
 *       204:
 *         description: Election deleted
 *       400:
 *         description: Invalid UUID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – not an admin or election belongs to a different faculty
 *       404:
 *         description: Election not found
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { id: electionId } = await params;
  if (!isValidUuid(electionId)) return Errors.badRequest('Invalid election id');

  const { admin } = auth;

  const election = await prisma.election.findUnique({
    where: { id: electionId },
    include: { restrictions: { select: { type: true, value: true } } },
  });
  if (!election) return Errors.notFound('Election not found');

  const restrictions = election.restrictions as ElectionRestriction[];

  if (!adminCanDeleteElection(admin.restricted_to_faculty, admin.faculty, restrictions)) {
    return Errors.forbidden('You can only delete elections of your own faculty');
  }

  await prisma.election.delete({ where: { id: electionId } });
  await invalidateElections();

  return new NextResponse(null, { status: 204 });
}
