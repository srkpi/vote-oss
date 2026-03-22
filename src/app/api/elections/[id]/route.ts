import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin, requireAuth } from '@/lib/auth';
import { invalidateElections } from '@/lib/cache';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils';

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
      _count: { select: { ballots: true } },
    },
  });

  if (!election) return Errors.notFound('Election not found');

  const { user } = auth;

  // Unrestricted admins may view any election.
  // Faculty-restricted admins may view global elections + their own faculty.
  // Regular users must match both faculty and group restrictions.
  if (user.isAdmin && !user.restrictedToFaculty) {
    // Unrestricted admin — no restriction check needed
  } else if (user.isAdmin && user.restrictedToFaculty) {
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
  const isOpen = now >= election.opens_at && now <= election.closes_at;

  // For open elections, check whether this user has already been issued a vote
  // token — a reliable server-side "already voted" signal. IssuedToken records
  // are deleted when tallies are computed after close, so this check is only
  // meaningful while the election is open.
  let hasVoted: boolean | undefined;
  if (isOpen) {
    const issuedToken = await prisma.issuedToken.findUnique({
      where: {
        election_id_user_id: { election_id: electionId, user_id: user.sub },
      },
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
    restrictedToFaculty: election.restricted_to_faculty,
    restrictedToGroup: election.restricted_to_group,
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
 *       200:
 *         description: Election deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 deletedId:
 *                   type: string
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
