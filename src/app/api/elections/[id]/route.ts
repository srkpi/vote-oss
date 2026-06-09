import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin, requireAuth } from '@/lib/auth';
import { getElectionBypassForUser } from '@/lib/bypass';
import { getCachedElections, invalidateElections, overlayLiveBallotCounts } from '@/lib/cache';
import { fetchFacultyGroups } from '@/lib/campus-api';
import type { StudyFormValue, StudyYearValue } from '@/lib/constants';
import {
  ELECTION_CHOICE_MAX_LENGTH,
  ELECTION_CHOICES_MAX,
  ELECTION_CHOICES_MIN,
  ELECTION_DESCRIPTION_MAX_LENGTH,
  ELECTION_MAX_CHOICES_MAX,
  ELECTION_MIN_CHOICES_MIN,
  ELECTION_TITLE_MAX_LENGTH,
  STUDY_FORMS,
  STUDY_YEARS,
  VALID_LEVEL_COURSES,
} from '@/lib/constants';
import { decryptBallot } from '@/lib/crypto';
import { decryptField } from '@/lib/encryption';
import { Errors } from '@/lib/errors';
import { buildAdminGraph } from '@/lib/graph';
import { getUserGroupMemberships } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import {
  adminCanAccessElection,
  adminCanDeleteElection,
  adminCanRestoreElection,
  checkRestrictionsWithBypass,
} from '@/lib/restrictions';
import { isValidUuid } from '@/lib/utils/common';
import { parseGroupLevel } from '@/lib/utils/group-utils';
import { shuffleChoicesForUser } from '@/lib/utils/shuffle-choices';
import {
  computeWinners,
  parseWinningConditions,
  validateWinningConditions,
} from '@/lib/winning-conditions';
import type {
  CreateElectionRestriction,
  ElectionRestrictedGroups,
  ElectionRestriction,
  ElectionType,
  TallyResult,
  WinningConditions,
} from '@/types/election';
import {
  DEFAULT_WINNING_CONDITIONS,
  DEFAULT_WINNING_CONDITIONS_SINGLE_CHOICE,
} from '@/types/election';

function safeDecrypt(value: string): string {
  try {
    return decryptField(value);
  } catch {
    return value;
  }
}

async function computeTallyInMemory(
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
      const { choiceIds } = decryptBallot(privateKeyPem, ballot.encrypted_ballot);
      for (const choiceId of choiceIds) {
        if (choiceId in tally) tally[choiceId]++;
      }
    } catch {
      console.error(`[tally] Failed to decrypt ballot for election ${electionId}`);
    }
  }

  return { tally, totalBallots: ballots.length };
}

/**
 * Compute tally AND persist it: writes vote_count on each choice and clears
 * issued tokens + nullifiers.  Only safe for closed elections — clearing
 * nullifiers during an open election would break anti-double-vote checks.
 */
async function computeAndPersistTally(
  electionId: string,
  privateKeyPem: string,
  choices: Array<{ id: string }>,
): Promise<{ tally: Record<string, number>; totalBallots: number }> {
  const { tally, totalBallots } = await computeTallyInMemory(electionId, privateKeyPem, choices);

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

  return { tally, totalBallots };
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
 *       winning conditions.  The `anonymous` field indicates whether voter
 *       identities are cryptographically embedded in ballots.  Access is
 *       subject to faculty/group eligibility.
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

  // ── Fetch election (cache-first) ──────────────────────────────────────────
  let electionData;
  const cached = await getCachedElections();

  if (cached) {
    const rawFound = cached.find((e) => e.id === electionId);
    if (!rawFound) return Errors.notFound('Election not found');
    // Overlay real-time ballot count so freshly-cast ballots are reflected
    // without waiting for full cache invalidation.
    const [found] = await overlayLiveBallotCounts([rawFound]);

    let winningConditions = found.winningConditions;
    if (!winningConditions) {
      winningConditions =
        found.choices.length === 1
          ? DEFAULT_WINNING_CONDITIONS_SINGLE_CHOICE
          : DEFAULT_WINNING_CONDITIONS;
    }

    electionData = {
      id: found.id,
      type: found.type,
      title: found.title,
      description: found.description,
      createdAt: new Date(found.createdAt),
      opensAt: new Date(found.opensAt),
      closesAt: new Date(found.closesAt),
      minChoices: found.minChoices,
      maxChoices: found.maxChoices,
      publicKey: found.publicKey,
      privateKey: found.privateKey,
      restrictions: found.restrictions as ElectionRestriction[],
      createdByFullName: found.createdByFullName,
      approved: found.approved,
      approvedById: found.approvedById,
      approvedByFullName: found.approvedByFullName,
      approvedAt: found.approvedAt ? new Date(found.approvedAt) : null,
      choices: found.choices,
      ballotCount: found.ballotCount,
      createdBy: found.createdBy,
      deletedAt: found.deletedAt ? new Date(found.deletedAt) : null,
      deletedByUserId: found.deletedByUserId,
      deletedByName: found.deletedByName,
      editedAt: found.editedAt ? new Date(found.editedAt) : null,
      editedByUserId: found.editedByUserId,
      editedByName: found.editedByName,
      winningConditions,
      shuffleChoices: found.shuffleChoices ?? false,
      publicViewing: found.publicViewing ?? false,
      anonymous: found.anonymous ?? true,
    };
  } else {
    const dbElection = await prisma.election.findUnique({
      where: { id: electionId },
      include: {
        choices: { orderBy: { position: 'asc' } },
        deleter: { select: { full_name: true } },
        editor: { select: { full_name: true } },
        restrictions: { select: { type: true, value: true } },
        _count: { select: { ballots: true } },
      },
    });

    if (!dbElection) return Errors.notFound('Election not found');

    electionData = {
      id: dbElection.id,
      type: dbElection.type as ElectionType,
      title: dbElection.title,
      description: dbElection.description ?? null,
      createdAt: dbElection.created_at,
      opensAt: dbElection.opens_at,
      closesAt: dbElection.closes_at,
      minChoices: dbElection.min_choices,
      maxChoices: dbElection.max_choices,
      publicKey: dbElection.public_key,
      privateKey: dbElection.private_key,
      restrictions: dbElection.restrictions as ElectionRestriction[],
      createdByFullName: safeDecrypt(dbElection.created_by_full_name),
      approved: dbElection.approved,
      approvedById: dbElection.approved_by_id,
      approvedByFullName: dbElection.approved_by_full_name
        ? safeDecrypt(dbElection.approved_by_full_name)
        : null,
      approvedAt: dbElection.approved_at,
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
      editedAt: dbElection.edited_at,
      editedByUserId: dbElection.edited_by,
      editedByName: dbElection.editor?.full_name ?? null,
      winningConditions: parseWinningConditions(dbElection.winning_conditions),
      shuffleChoices: dbElection.shuffle_choices,
      publicViewing: dbElection.public_viewing,
      anonymous: dbElection.anonymous,
    };
  }

  // Hidden from non-admins when deleted
  if (!isAdmin && electionData.deletedAt) {
    return Errors.notFound('Election not found');
  }

  // Unapproved petitions: visible only to creator and manage_petitions admins
  if (electionData.type === 'PETITION' && !electionData.approved) {
    const isPetitionManager = isAdmin && user.managePetitions === true;
    if (!isPetitionManager && electionData.createdBy !== user.sub) {
      return Errors.notFound('Election not found');
    }
  }

  const restrictions = electionData.restrictions;
  const { publicViewing } = electionData;

  // ── Access & eligibility check ────────────────────────────────────────────
  // userCanVote = whether this specific user meets the voting restrictions.
  // When publicViewing=true, we skip the 403 for viewers but still track eligibility.

  let userCanVote = false;
  let bypassedTypes: string[] = [];

  const groupMembershipRestrictions = restrictions.filter((r) => r.type === 'GROUP_MEMBERSHIP');
  const groupMembershipRestrictionsIds = groupMembershipRestrictions.map((r) => r.value);

  if (isAdmin && !user.restrictedToFaculty) {
    userCanVote = true;
  } else if (isAdmin && user.restrictedToFaculty) {
    const eligible = adminCanAccessElection(user.faculty, restrictions);
    userCanVote = eligible;
    if (!eligible && !publicViewing) {
      return Errors.forbidden('You are not eligible for this election');
    }
  } else {
    // Regular user: fetch bypass tokens and group memberships concurrently
    const [fetchedBypass, groupMemberships] = await Promise.all([
      getElectionBypassForUser(user.sub, electionId),
      groupMembershipRestrictions.length > 0
        ? getUserGroupMemberships(user.sub)
        : Promise.resolve(null),
    ]);

    bypassedTypes = fetchedBypass ?? [];
    userCanVote = checkRestrictionsWithBypass(restrictions, user, bypassedTypes, groupMemberships);

    if (!userCanVote && !publicViewing) {
      return Errors.forbidden('You are not eligible for this election');
    }
  }

  let restrictedGroups: ElectionRestrictedGroups[] | undefined = undefined;
  if (groupMembershipRestrictionsIds.length > 0) {
    restrictedGroups = await prisma.group.findMany({
      select: { id: true, name: true },
      where: { id: { in: groupMembershipRestrictionsIds } },
    });
  }

  // ── Tally ─────────────────────────────────────────────────────────────────
  const now = new Date();
  const isClosed = now > electionData.closesAt;
  const isOpen = now >= electionData.opensAt && now <= electionData.closesAt;
  const isUpcoming = now < electionData.opensAt;
  const { anonymous } = electionData;

  const privateKeyPem = decryptField(electionData.privateKey);
  const { winningConditions } = electionData;

  // Non-anonymous elections are simultaneously "open" — tally and private key
  // are exposed during voting, not only after close.  For anonymous elections
  // we keep the zero-knowledge gate until the election closes.
  const exposeResults = isClosed || (!anonymous && isOpen);

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
  } else if (!anonymous && isOpen && electionData.ballotCount > 0) {
    // Live in-memory tally for non-anonymous open elections. No DB writes —
    // we must not clear IssuedToken/UsedTokenNullifier while voting is active.
    const { tally, totalBallots } = await computeTallyInMemory(
      electionId,
      privateKeyPem,
      electionData.choices,
    );
    tallyResults = buildTallyResults(tally, totalBallots, electionData.choices, winningConditions);
  }

  // ── hasVoted ──────────────────────────────────────────────────────────────
  let hasVoted: boolean | undefined;
  if (isOpen) {
    const issuedToken = await prisma.issuedToken.findUnique({
      where: { election_id_user_id: { election_id: electionId, user_id: user.sub } },
    });
    hasVoted = issuedToken !== null;
  }

  // ── Admin extras ──────────────────────────────────────────────────────────
  let canDelete: boolean | undefined;
  let canRestore: boolean | undefined;
  let canEdit: boolean | undefined;
  let deletedByField: { userId: string; fullName: string } | null | undefined;
  let editedByField: { userId: string; fullName: string } | null | undefined;

  if (isAdmin) {
    const adminRecord = await prisma.admin.findUnique({
      where: { user_id: user.sub, deleted_at: null },
    });
    if (adminRecord) {
      const isDeleted = !!electionData.deletedAt;

      // Petitions bypass the admin-hierarchy gating used for regular elections:
      // any admin with `manage_petitions` may delete or restore a petition.
      if (electionData.type === 'PETITION') {
        canDelete = !isDeleted && adminRecord.manage_petitions;
        canRestore = isDeleted && adminRecord.manage_petitions;
        canEdit = false;
      } else {
        const adminGraph = await buildAdminGraph();
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

        canEdit =
          !isDeleted &&
          isUpcoming &&
          adminCanDeleteElection(
            {
              restricted_to_faculty: adminRecord.restricted_to_faculty,
              faculty: adminRecord.faculty,
              user_id: adminRecord.user_id,
            },
            { restrictions, created_by: electionData.createdBy },
            adminGraph,
          );
      }
    }

    deletedByField = electionData.deletedByUserId
      ? { userId: electionData.deletedByUserId, fullName: electionData.deletedByName ?? '' }
      : null;

    editedByField = electionData.editedByUserId
      ? { userId: electionData.editedByUserId, fullName: electionData.editedByName ?? '' }
      : null;
  }

  // ── Build choices ─────────────────────────────────────────────────────────
  const tallyMap = new Map(tallyResults?.map((r) => [r.choiceId, r]));
  let choices = electionData.choices.map((c) => {
    const base = { id: c.id, choice: c.choice, position: c.position };
    if (exposeResults && tallyResults) {
      const r = tallyMap.get(c.id);
      return { ...base, votes: r?.votes ?? 0, winner: r?.winner ?? false };
    }
    return base;
  });

  // Only shuffle for users who can vote; public viewers see canonical order
  if (electionData.shuffleChoices && userCanVote) {
    choices = shuffleChoicesForUser(choices, user.sub, electionId);
  }

  return NextResponse.json({
    id: electionData.id,
    type: electionData.type,
    title: electionData.title,
    description: electionData.description,
    createdAt: electionData.createdAt,
    opensAt: electionData.opensAt,
    closesAt: electionData.closesAt,
    status:
      now < electionData.opensAt ? 'upcoming' : now <= electionData.closesAt ? 'open' : 'closed',
    restrictions,
    minChoices: electionData.minChoices,
    maxChoices: electionData.maxChoices,
    publicKey: electionData.publicKey,
    publicViewing,
    anonymous: electionData.anonymous,
    privateKey: exposeResults ? privateKeyPem : undefined,
    createdBy: {
      userId: electionData.createdBy,
      fullName: electionData.createdByFullName,
    },
    approved: electionData.approved,
    approvedBy:
      electionData.approvedById && electionData.approvedByFullName
        ? { userId: electionData.approvedById, fullName: electionData.approvedByFullName }
        : null,
    approvedAt: electionData.approvedAt?.toISOString?.() ?? electionData.approvedAt ?? null,
    choices,
    ballotCount: electionData.ballotCount,
    winningConditions,
    shuffleChoices: electionData.shuffleChoices,
    hasVoted,
    bypassedTypes,
    restrictedGroups,
    ...(isAdmin && {
      deletedAt: electionData.deletedAt?.toISOString() ?? null,
      deletedBy: deletedByField,
      editedAt: electionData.editedAt?.toISOString() ?? null,
      editedBy: editedByField,
      canDelete,
      canRestore,
      canEdit,
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

  // Petitions are deleted by manage_petitions admins regardless of hierarchy.
  if (election.type === 'PETITION') {
    if (!admin.manage_petitions) {
      return Errors.forbidden('Only petition managers can delete petitions');
    }
  } else {
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
        'You can only delete elections you created or that were created by your subordinates',
      );
    }
  }

  await prisma.election.update({
    where: { id: electionId },
    data: { deleted_at: new Date(), deleted_by: admin.user_id },
  });

  await invalidateElections();

  return new NextResponse(null, { status: 204 });
}

// ---------------------------------------------------------------------------
// PATCH /api/elections/[id]
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/elections/{id}:
 *   patch:
 *     summary: Update an upcoming election
 *     description: >
 *       Updates the configuration, choices, restrictions, and metadata of an
 *       existing election. This operation is restricted to administrators.
 *       An election can only be edited if it has not started yet (current time
 *       is before `opensAt`) and it is not a petition. The updating admin
 *       must have created the election or be an ancestor of the creator in
 *       the admin hierarchy. The update completely replaces existing choices
 *       and restrictions.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ElectionEditBody'
 *     responses:
 *       204:
 *         description: Election updated successfully. No content returned.
 *       400:
 *         description: >
 *           Invalid request. Reason can include: invalid UUID, invalid JSON,
 *           missing required fields, malformed dates, violation of choice
 *           bounds (min/max constraints), target election is a petition,
 *           election has already started, or failed restriction validations
 *           (e.g., graduate course constraints, faculty mismatch).
 *       401:
 *         description: Unauthorized. Session cookie missing or invalid.
 *       403:
 *         description: >
 *           Forbidden. User is not an admin, or does not have permissions
 *           over this election, its faculty scope, or the specified group
 *           constraints.
 *       404:
 *         description: Election not found or has been soft-deleted.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { id: electionId } = await params;
  if (!isValidUuid(electionId)) return Errors.badRequest('Invalid election id');

  const { admin } = auth;

  // Fetch existing election with restrictions
  const election = await prisma.election.findUnique({
    where: { id: electionId },
    include: { restrictions: { select: { type: true, value: true } } },
  });

  if (!election || election.deleted_at) return Errors.notFound('Election not found');
  if (election.type === 'PETITION') return Errors.badRequest('Petitions cannot be edited');

  const now = new Date();
  if (election.opens_at <= now) {
    return Errors.badRequest('Cannot edit an election that has already started');
  }

  // Check admin has permission (same as delete)
  const existingRestrictions = election.restrictions as ElectionRestriction[];
  const adminGraph = await buildAdminGraph();

  if (
    !adminCanDeleteElection(
      {
        restricted_to_faculty: admin.restricted_to_faculty,
        faculty: admin.faculty,
        user_id: admin.user_id,
      },
      { restrictions: existingRestrictions, created_by: election.created_by },
      adminGraph,
    )
  ) {
    return Errors.forbidden(
      'You can only edit elections you created or that were created by your subordinates',
    );
  }

  // Parse body
  let body: {
    title?: string;
    description?: string | null;
    opensAt?: string;
    closesAt?: string;
    choices?: string[];
    minChoices?: number;
    maxChoices?: number;
    restrictions?: CreateElectionRestriction[];
    winningConditions?: unknown;
    shuffleChoices?: boolean;
    publicViewing?: boolean;
    anonymous?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { title, opensAt, closesAt, choices } = body;
  const description = typeof body.description === 'string' ? body.description.trim() : null;
  const minChoices = body.minChoices ?? ELECTION_MIN_CHOICES_MIN;
  const maxChoices = body.maxChoices ?? ELECTION_MIN_CHOICES_MIN;
  const restrictions: CreateElectionRestriction[] = body.restrictions ?? [];
  const shuffleChoices = body.shuffleChoices === true;
  const publicViewing =
    body.publicViewing === undefined ? !restrictions.length : body.publicViewing === true;
  const anonymous = body.anonymous === false ? false : true;

  // Basic validation
  if (!title || !opensAt || !closesAt || !choices?.length) {
    return Errors.badRequest('title, opensAt, closesAt, choices are required');
  }
  if (!publicViewing && !restrictions.length) {
    return Errors.badRequest('publicViewing can not be false if no restrictions applied');
  }
  if (title.length > ELECTION_TITLE_MAX_LENGTH) {
    return Errors.badRequest(`Title must be at most ${ELECTION_TITLE_MAX_LENGTH} characters`);
  }
  if (description && description.length > ELECTION_DESCRIPTION_MAX_LENGTH) {
    return Errors.badRequest(
      `Description must be at most ${ELECTION_DESCRIPTION_MAX_LENGTH} characters`,
    );
  }
  if (choices.length < ELECTION_CHOICES_MIN) {
    return Errors.badRequest('At least 1 choice is required');
  }
  if (choices.length > ELECTION_CHOICES_MAX) {
    return Errors.badRequest(`At most ${ELECTION_CHOICES_MAX} choices are allowed`);
  }
  if (choices.length === 1 && shuffleChoices) {
    return Errors.badRequest('Shuffle choices is not possible for a single-choice election');
  }
  const tooLongChoice = choices.find((c) => c.length > ELECTION_CHOICE_MAX_LENGTH);
  if (tooLongChoice) {
    return Errors.badRequest(
      `Each choice must be at most ${ELECTION_CHOICE_MAX_LENGTH} characters`,
    );
  }
  if (minChoices < ELECTION_MIN_CHOICES_MIN) {
    return Errors.badRequest(`minChoices must be at least ${ELECTION_MIN_CHOICES_MIN}`);
  }
  if (maxChoices > ELECTION_MAX_CHOICES_MAX) {
    return Errors.badRequest(`maxChoices must be at most ${ELECTION_MAX_CHOICES_MAX}`);
  }
  if (maxChoices < minChoices) {
    return Errors.badRequest('maxChoices must be >= minChoices');
  }
  if (maxChoices > choices.length) {
    return Errors.badRequest('maxChoices cannot exceed the number of choices');
  }

  const openDate = new Date(opensAt);
  const closeDate = new Date(closesAt);

  if (isNaN(openDate.getTime())) return Errors.badRequest('Invalid opensAt date');
  if (isNaN(closeDate.getTime())) return Errors.badRequest('Invalid closesAt date');
  if (closeDate <= openDate) return Errors.badRequest('closesAt must be after opensAt');
  if (closeDate.getTime() <= now.getTime()) {
    return Errors.badRequest('closesAt must be in the future');
  }

  // Winning conditions
  let winningConditionsRaw = body.winningConditions;
  if (winningConditionsRaw === undefined || winningConditionsRaw === null) {
    winningConditionsRaw =
      choices.length === 1 ? DEFAULT_WINNING_CONDITIONS_SINGLE_CHOICE : DEFAULT_WINNING_CONDITIONS;
  }

  const winningConditionsResult = validateWinningConditions(winningConditionsRaw, choices.length);
  if (typeof winningConditionsResult === 'string') {
    return Errors.badRequest(winningConditionsResult);
  }
  const winningConditions: WinningConditions = winningConditionsResult;

  // Restriction validation
  const VALID_RESTRICTION_TYPES = new Set<string>([
    'FACULTY',
    'GROUP',
    'STUDY_YEAR',
    'STUDY_FORM',
    'LEVEL_COURSE',
    'GROUP_MEMBERSHIP',
    'BYPASS_REQUIRED',
  ]);

  for (const r of restrictions) {
    if (!VALID_RESTRICTION_TYPES.has(r.type)) {
      return Errors.badRequest(`Unknown restriction type "${r.type}"`);
    }
    if (typeof r.value !== 'string' || !r.value.trim()) {
      return Errors.badRequest(`Restriction value must be a non-empty string`);
    }
  }

  const groupRestrictions = restrictions.filter((r) => r.type === 'GROUP');
  const facultyRestrictions = restrictions.filter((r) => r.type === 'FACULTY');
  const bypassRestrictions = restrictions.filter((r) => r.type === 'BYPASS_REQUIRED');
  const groupMembershipRestrictions = restrictions.filter((r) => r.type === 'GROUP_MEMBERSHIP');

  if (admin.restricted_to_faculty) {
    if (facultyRestrictions.length > 0) {
      if (facultyRestrictions.length > 1 || facultyRestrictions[0].value !== admin.faculty) {
        return Errors.badRequest(
          `Faculty-restricted admins may only restrict elections to their own faculty ("${admin.faculty}")`,
        );
      }
    } else if (groupMembershipRestrictions.length === 0) {
      return Errors.badRequest(
        `Faculty-restricted admins must include a FACULTY restriction for their faculty ("${admin.faculty}"), unless at least one GROUP_MEMBERSHIP restriction is specified`,
      );
    }
  }

  if (groupRestrictions.length > 0 && facultyRestrictions.length === 0) {
    return Errors.badRequest('GROUP restrictions require at least one FACULTY restriction');
  }

  if (bypassRestrictions.length > 1) {
    return Errors.badRequest('Only one BYPASS_REQUIRED restriction is allowed');
  }

  if (bypassRestrictions.length === 1 && bypassRestrictions[0].value !== 'true') {
    return Errors.badRequest('BYPASS_REQUIRED restriction value should be "true"');
  }

  // GROUP_MEMBERSHIP: allow groups from original election even if admin no longer owns them
  if (groupMembershipRestrictions.length > 0) {
    const originalGroupMembershipIds = new Set(
      existingRestrictions.filter((r) => r.type === 'GROUP_MEMBERSHIP').map((r) => r.value),
    );

    const groupIds = groupMembershipRestrictions.map((r) => r.value);
    const existingGroups = await prisma.group.findMany({
      where: { id: { in: groupIds }, deleted_at: null },
      select: { id: true, owner_id: true },
    });

    const existingIds = new Set(existingGroups.map((g) => g.id));
    for (const gid of groupIds) {
      if (!existingIds.has(gid) && !originalGroupMembershipIds.has(gid)) {
        return Errors.badRequest(`Group "${gid}" does not exist or has been deleted`);
      }
    }

    if (!admin.manage_groups) {
      for (const g of existingGroups) {
        if (g.owner_id !== admin.user_id && !originalGroupMembershipIds.has(g.id)) {
          return Errors.badRequest(
            `You can only restrict elections to groups you own. Group "${g.id}" belongs to another user.`,
          );
        }
      }
    }
  }

  for (const r of restrictions.filter((r) => r.type === 'STUDY_YEAR')) {
    const year = Number(r.value);
    if (!STUDY_YEARS.includes(year as StudyYearValue)) {
      return Errors.badRequest(
        `Invalid study year "${r.value}". Must be one of: ${STUDY_YEARS.join(', ')}`,
      );
    }
  }

  for (const r of restrictions.filter((r) => r.type === 'STUDY_FORM')) {
    if (!STUDY_FORMS.includes(r.value as StudyFormValue)) {
      return Errors.badRequest(
        `Invalid study form "${r.value}". Must be one of: ${STUDY_FORMS.join(', ')}`,
      );
    }
  }

  for (const r of restrictions.filter((r) => r.type === 'LEVEL_COURSE')) {
    if (!VALID_LEVEL_COURSES.includes(r.value)) {
      return Errors.badRequest(
        `Invalid level/course value "${r.value}". Must be one of: ${VALID_LEVEL_COURSES.join(', ')}`,
      );
    }
    if (r.value.startsWith('g')) {
      return Errors.badRequest(`Graduate-level course restrictions are not permitted.`);
    }
  }

  if (facultyRestrictions.length > 0 || groupRestrictions.length > 0) {
    let facultyGroups: Record<string, string[]>;
    try {
      facultyGroups = await fetchFacultyGroups();
    } catch {
      return Errors.internal(
        'Could not validate faculty/group: campus API is unavailable. Please try again later.',
      );
    }

    for (const r of facultyRestrictions) {
      if (!facultyGroups[r.value]) {
        return Errors.badRequest(`Faculty "${r.value}" does not exist`);
      }
    }

    if (groupRestrictions.length > 0) {
      const selectedGroupValues = groupRestrictions.map((r) => r.value);
      const redundantFaculties = facultyRestrictions.filter((f) => {
        const groupsInFaculty = facultyGroups[f.value] ?? [];
        return !selectedGroupValues.some((g) => groupsInFaculty.includes(g));
      });

      if (redundantFaculties.length > 0) {
        const names = redundantFaculties.map((f) => f.value).join(', ');
        return Errors.badRequest(
          `Redundant faculty restrictions: no selected groups belong to ${names}`,
        );
      }
    }

    for (const r of groupRestrictions) {
      const validFaculties = facultyRestrictions.map((f) => f.value);
      const groupExistsInFaculty = validFaculties.some((f) =>
        (facultyGroups[f] ?? []).includes(r.value),
      );
      if (!groupExistsInFaculty) {
        return Errors.badRequest(`Group "${r.value}" does not exist in the specified faculties`);
      }
      if (parseGroupLevel(r.value) === 'g') {
        return Errors.badRequest(
          `Group "${r.value}" is a graduate group. Elections targeting graduate students are not permitted.`,
        );
      }
    }
  }

  // Update in transaction: delete old choices & restrictions, then update
  await prisma.$transaction(async (tx) => {
    await tx.electionChoice.deleteMany({ where: { election_id: electionId } });
    await tx.electionRestriction.deleteMany({ where: { election_id: electionId } });
    await tx.election.update({
      where: { id: electionId },
      data: {
        title,
        description,
        opens_at: now > openDate ? now : openDate,
        closes_at: closeDate,
        min_choices: minChoices,
        max_choices: maxChoices,
        winning_conditions: winningConditions,
        shuffle_choices: shuffleChoices,
        public_viewing: publicViewing,
        anonymous,
        edited_at: now,
        edited_by: admin.user_id,
        choices: {
          create: choices.map((choice, i) => ({ choice, position: i })),
        },
        restrictions: {
          create: restrictions.map((r) => ({ type: r.type, value: r.value })),
        },
      },
    });
  });

  await invalidateElections();

  return new NextResponse(null, { status: 204 });
}
