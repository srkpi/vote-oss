import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin, requireAuth } from '@/lib/auth';
import { getElectionBypassForUser } from '@/lib/bypass';
import { getCachedElections, invalidateElections } from '@/lib/cache';
import { decryptBallot } from '@/lib/crypto';
import { decryptField } from '@/lib/encryption';
import { Errors } from '@/lib/errors';
import { buildAdminGraph } from '@/lib/graph';
import { prisma } from '@/lib/prisma';
import {
  adminCanAccessElection,
  adminCanDeleteElection,
  adminCanRestoreElection,
  checkRestrictionsWithBypass,
} from '@/lib/restrictions';
import { isValidUuid } from '@/lib/utils/common';
import { computeWinners, parseWinningConditions } from '@/lib/winning-conditions';
import type { ElectionRestriction, TallyResult, WinningConditions } from '@/types/election';
import { DEFAULT_WINNING_CONDITIONS } from '@/types/election';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute vote tallies from raw ballots, persist them to ElectionChoice,
 * clean up issued tokens + nullifiers, and invalidate the elections cache.
 * Returns the tally and total ballot count.
 */
async function computeAndPersistTally(
  electionId: string,
  privateKeyPem: string,
  choices: Array<{ id: string }>,
): Promise<{ tally: Record<string, number>; totalBallots: number }> {
  const ballots = await prisma.ballot.findMany({
    where: { election_id: electionId },
    select: { encrypted_ballot: true },
  });

  const tally: Record<string, number> = {};
  for (const c of choices) tally[c.id] = 0;

  for (const ballot of ballots) {
    try {
      const choiceIds = decryptBallot(privateKeyPem, ballot.encrypted_ballot);
      for (const choiceId of choiceIds) {
        if (choiceId in tally) tally[choiceId]++;
      }
    } catch {
      console.error(`[tally] Failed to decrypt ballot for election ${electionId}`);
    }
  }

  await prisma.$transaction([
    ...choices.map((c) =>
      prisma.electionChoice.update({
        where: { id: c.id },
        data: { vote_count: tally[c.id] ?? 0 },
      }),
    ),
    prisma.issuedToken.deleteMany({ where: { election_id: electionId } }),
    prisma.usedTokenNullifier.deleteMany({ where: { election_id: electionId } }),
  ]);

  await invalidateElections();

  return { tally, totalBallots: ballots.length };
}

function buildTallyResults(
  tally: Record<string, number>,
  totalBallots: number,
  choices: Array<{ id: string; choice: string; position: number }>,
  conditions: WinningConditions,
): TallyResult[] {
  const winners = computeWinners(tally, totalBallots, conditions);
  return choices.map((c) => ({
    choiceId: c.id,
    choice: c.choice,
    position: c.position,
    votes: tally[c.id] ?? 0,
    winner: winners[c.id] ?? false,
  }));
}

// ---------------------------------------------------------------------------
// GET /api/elections/[id]
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/elections/{id}:
 *   get:
 *     summary: Get a single election
 *     description: >
 *       Returns full election details including choices, ballot count, and
 *       winning conditions.  Access is subject to faculty/group eligibility.
 *       The private key is only included after the election has closed.  For
 *       open elections a `hasVoted` flag indicates whether the caller has
 *       already been issued a vote token.  For closed elections, choices
 *       include `votes` and `winner` fields computed using the election's
 *       winning conditions.
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

  const { user } = auth;
  const isAdmin = user.isAdmin ?? false;

  let electionData: {
    id: string;
    title: string;
    createdAt: Date;
    opensAt: Date;
    closesAt: Date;
    minChoices: number;
    maxChoices: number;
    publicKey: string;
    privateKey: string;
    restrictions: ElectionRestriction[];
    creator: { fullName: string; faculty: string };
    choices: { id: string; choice: string; position: number; voteCount: number | null }[];
    ballotCount: number;
    createdBy: string;
    deletedAt: Date | null;
    deletedByUserId: string | null;
    deletedByName: string | null;
    winningConditions: WinningConditions;
  };

  const cached = await getCachedElections();

  if (cached) {
    const found = cached.find((e) => e.id === electionId);
    if (!found) return Errors.notFound('Election not found');

    electionData = {
      id: found.id,
      title: found.title,
      createdAt: new Date(found.createdAt),
      opensAt: new Date(found.opensAt),
      closesAt: new Date(found.closesAt),
      minChoices: found.minChoices,
      maxChoices: found.maxChoices,
      publicKey: found.publicKey,
      privateKey: found.privateKey,
      restrictions: found.restrictions as ElectionRestriction[],
      creator: found.creator,
      choices: found.choices,
      ballotCount: found.ballotCount,
      createdBy: found.createdBy,
      deletedAt: found.deletedAt ? new Date(found.deletedAt) : null,
      deletedByUserId: found.deletedByUserId,
      deletedByName: found.deletedByName,
      winningConditions: found.winningConditions ?? { ...DEFAULT_WINNING_CONDITIONS },
    };
  } else {
    const dbElection = await prisma.election.findUnique({
      where: { id: electionId },
      include: {
        choices: { orderBy: { position: 'asc' } },
        creator: { select: { full_name: true, faculty: true } },
        deleter: { select: { full_name: true } },
        restrictions: { select: { type: true, value: true } },
        _count: { select: { ballots: true } },
      },
    });

    if (!dbElection) return Errors.notFound('Election not found');

    electionData = {
      id: dbElection.id,
      title: dbElection.title,
      createdAt: dbElection.created_at,
      opensAt: dbElection.opens_at,
      closesAt: dbElection.closes_at,
      minChoices: dbElection.min_choices,
      maxChoices: dbElection.max_choices,
      publicKey: dbElection.public_key,
      privateKey: dbElection.private_key,
      restrictions: dbElection.restrictions as ElectionRestriction[],
      creator: { fullName: dbElection.creator.full_name, faculty: dbElection.creator.faculty },
      choices: dbElection.choices.map((c) => ({
        id: c.id,
        choice: c.choice,
        position: c.position,
        voteCount: c.vote_count,
      })),
      ballotCount: dbElection._count.ballots,
      createdBy: dbElection.created_by,
      deletedAt: dbElection.deleted_at,
      deletedByUserId: dbElection.deleted_by,
      deletedByName: dbElection.deleter?.full_name ?? null,
      winningConditions: parseWinningConditions(dbElection.winning_conditions),
    };
  }

  if (!isAdmin && electionData.deletedAt) {
    return Errors.notFound('Election not found');
  }

  const restrictions = electionData.restrictions;
  const bypassedTypes = await getElectionBypassForUser(user.sub, electionId);

  if (isAdmin && !user.restrictedToFaculty) {
    // Unrestricted admin — always pass
  } else if (isAdmin && user.restrictedToFaculty) {
    if (!adminCanAccessElection(user.faculty, restrictions)) {
      return Errors.forbidden('You are not eligible for this election');
    }
  } else {
    if (!checkRestrictionsWithBypass(restrictions, user, bypassedTypes)) {
      return Errors.forbidden('You are not eligible for this election');
    }
  }

  const now = new Date();
  const isClosed = now > electionData.closesAt;
  const isOpen = now >= electionData.opensAt && now <= electionData.closesAt;

  const privateKeyPem = decryptField(electionData.privateKey);
  const { winningConditions } = electionData;

  let tallyResults: TallyResult[] | undefined;
  if (isClosed) {
    const needsComputation = electionData.choices.some((c) => c.voteCount === null);
    if (needsComputation) {
      const { tally, totalBallots } = await computeAndPersistTally(
        electionId,
        privateKeyPem,
        electionData.choices,
      );
      tallyResults = buildTallyResults(
        tally,
        totalBallots,
        electionData.choices,
        winningConditions,
      );
    } else {
      const tally: Record<string, number> = {};
      for (const c of electionData.choices) tally[c.id] = c.voteCount ?? 0;
      tallyResults = buildTallyResults(
        tally,
        electionData.ballotCount,
        electionData.choices,
        winningConditions,
      );
    }
  }

  let hasVoted: boolean | undefined;
  if (isOpen) {
    const issuedToken = await prisma.issuedToken.findUnique({
      where: { election_id_user_id: { election_id: electionId, user_id: user.sub } },
    });
    hasVoted = issuedToken !== null;
  }

  let canDelete: boolean | undefined;
  let canRestore: boolean | undefined;
  let deletedByField: { userId: string; fullName: string } | null | undefined;

  if (isAdmin) {
    const adminRecord = await prisma.admin.findUnique({
      where: { user_id: user.sub, deleted_at: null },
    });
    if (adminRecord) {
      const adminGraph = await buildAdminGraph();
      const isDeleted = !!electionData.deletedAt;

      canDelete =
        !isDeleted &&
        adminCanDeleteElection(
          {
            restricted_to_faculty: adminRecord.restricted_to_faculty,
            faculty: adminRecord.faculty,
            user_id: adminRecord.user_id,
          },
          { restrictions, created_by: electionData.createdBy },
          adminGraph,
        );

      canRestore =
        isDeleted &&
        adminCanRestoreElection(
          {
            restricted_to_faculty: adminRecord.restricted_to_faculty,
            faculty: adminRecord.faculty,
            user_id: adminRecord.user_id,
          },
          { restrictions, deletedByUserId: electionData.deletedByUserId },
          adminGraph,
        );
    }

    deletedByField = electionData.deletedByUserId
      ? { userId: electionData.deletedByUserId, fullName: electionData.deletedByName ?? '' }
      : null;
  }

  const tallyMap = new Map(tallyResults?.map((r) => [r.choiceId, r]));
  const choices = electionData.choices.map((c) => {
    const base = { id: c.id, choice: c.choice, position: c.position };
    if (isClosed && tallyResults) {
      const r = tallyMap.get(c.id);
      return { ...base, votes: r?.votes ?? 0, winner: r?.winner ?? false };
    }
    return base;
  });

  return NextResponse.json({
    id: electionData.id,
    title: electionData.title,
    createdAt: electionData.createdAt,
    opensAt: electionData.opensAt,
    closesAt: electionData.closesAt,
    status:
      now < electionData.opensAt ? 'upcoming' : now <= electionData.closesAt ? 'open' : 'closed',
    restrictions,
    minChoices: electionData.minChoices,
    maxChoices: electionData.maxChoices,
    publicKey: electionData.publicKey,
    privateKey: isClosed ? privateKeyPem : undefined,
    creator: electionData.creator,
    choices,
    ballotCount: electionData.ballotCount,
    winningConditions,
    hasVoted,
    bypassedTypes: bypassedTypes ?? [],
    ...(isAdmin && {
      deletedAt: electionData.deletedAt?.toISOString() ?? null,
      deletedBy: deletedByField,
      canDelete,
      canRestore,
    }),
  });
}

// ---------------------------------------------------------------------------
// DELETE /api/elections/[id]
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/elections/{id}:
 *   delete:
 *     summary: Soft-delete an election
 *     description: >
 *       Marks an election as deleted (sets deleted_at / deleted_by). The
 *       election is hidden from non-admin users immediately but remains
 *       visible to admins and can be restored. Requires admin authentication.
 *       Admins may only delete elections that were created by themselves or a
 *       subordinate in the admin hierarchy.
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
  if (election.deleted_at) return Errors.notFound('Election not found');

  const restrictions = election.restrictions as ElectionRestriction[];
  const adminGraph = await buildAdminGraph();

  if (
    !adminCanDeleteElection(
      {
        restricted_to_faculty: admin.restricted_to_faculty,
        faculty: admin.faculty,
        user_id: admin.user_id,
      },
      { restrictions, created_by: election.created_by },
      adminGraph,
    )
  ) {
    return Errors.forbidden(
      'You can only delete elections you created or that were created by your subordinates within your faculty',
    );
  }

  await prisma.election.update({
    where: { id: electionId },
    data: { deleted_at: new Date(), deleted_by: admin.user_id },
  });

  await invalidateElections();

  return new NextResponse(null, { status: 204 });
}
