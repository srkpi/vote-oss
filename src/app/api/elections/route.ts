import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin, requireAuth } from '@/lib/auth';
import {
  getCachedAdmins,
  getCachedElections,
  invalidateElections,
  setCachedElections,
} from '@/lib/cache';
import { fetchFacultyGroups } from '@/lib/campus-api';
import type { StudyFormValue, StudyYearValue } from '@/lib/constants';
import {
  ELECTION_CHOICE_MAX_LENGTH,
  ELECTION_CHOICES_MAX,
  ELECTION_CHOICES_MIN,
  ELECTION_MAX_CHOICES_MAX,
  ELECTION_MAX_CLOSES_AT_DAYS,
  ELECTION_MIN_CHOICES_MIN,
  ELECTION_TITLE_MAX_LENGTH,
  STUDY_FORMS,
  STUDY_YEARS,
  VALID_LEVEL_COURSES,
} from '@/lib/constants';
import { generateElectionKeyPair } from '@/lib/crypto';
import { encryptField } from '@/lib/encryption';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import {
  adminCanAccessElection,
  adminCanDeleteElection,
  adminCanRestoreElection,
  checkRestrictions,
} from '@/lib/restrictions';
import { parseGroupLevel } from '@/lib/utils/group-utils';
import { shuffleChoicesForUser } from '@/lib/utils/shuffle-choices';
import {
  computeWinners,
  parseWinningConditions,
  validateWinningConditions,
} from '@/lib/winning-conditions';
import type {
  CachedElection,
  CachedElectionChoice,
  CreateElectionRestriction,
  Election,
  ElectionStatus,
  RestrictionType,
  TallyResult,
  WinningConditions,
} from '@/types/election';
import {
  DEFAULT_WINNING_CONDITIONS,
  DEFAULT_WINNING_CONDITIONS_SINGLE_CHOICE,
} from '@/types/election';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeStatus(opensAt: string | Date, closesAt: string | Date): ElectionStatus {
  const now = Date.now();
  const open = typeof opensAt === 'string' ? new Date(opensAt).getTime() : opensAt.getTime();
  const close = typeof closesAt === 'string' ? new Date(closesAt).getTime() : closesAt.getTime();

  if (now < open) return 'upcoming';
  if (now <= close) return 'open';
  return 'closed';
}

/**
 * Build tally results from cached choices using winning conditions.
 * Returns null if any voteCount is still null (tallies not yet computed).
 */
function buildTallyResults(
  choices: CachedElectionChoice[],
  ballotCount: number,
  conditions: WinningConditions,
): TallyResult[] | null {
  if (choices.some((c) => c.voteCount === null)) return null;

  const tally: Record<string, number> = {};
  for (const c of choices) tally[c.id] = c.voteCount!;

  const winners = computeWinners(tally, ballotCount, conditions);

  return choices.map((c) => ({
    choiceId: c.id,
    choice: c.choice,
    position: c.position,
    votes: c.voteCount!,
    winner: winners[c.id] ?? false,
  }));
}

/** Build a userId → promoted_by map from cache or DB. */
async function buildAdminGraph(): Promise<Map<string, string | null>> {
  const cachedAdmins = await getCachedAdmins();
  if (cachedAdmins) {
    return new Map(cachedAdmins.map((a) => [a.userId, a.promoter?.userId ?? null]));
  }
  const dbAdmins = await prisma.admin.findMany({
    where: { deleted_at: null },
    select: { user_id: true, promoted_by: true },
  });
  return new Map(dbAdmins.map((a) => [a.user_id, a.promoted_by]));
}

type AdminContext = {
  user_id: string;
  restricted_to_faculty: boolean;
  faculty: string;
};

function toClientElections(
  cached: CachedElection[],
  user: {
    sub: string;
    faculty: string;
    group: string;
    speciality?: string;
    studyYear?: number;
    studyForm?: string;
    isAdmin?: boolean;
    restrictedToFaculty?: boolean;
  },
  adminRecord?: AdminContext,
  adminGraph?: Map<string, string | null>,
): Election[] {
  const isAdmin = user.isAdmin ?? false;
  const isAdminRestricted = user.restrictedToFaculty ?? true;

  return cached
    .filter((e) => {
      const isDeleted = !!e.deletedAt;
      if (!isAdmin && isDeleted) return false;
      if (isAdmin && !isAdminRestricted) return true;
      if (isAdmin && isAdminRestricted) {
        return adminCanAccessElection(user.faculty, e.restrictions);
      }
      // Regular users: only show elections they're eligible for
      // (GROUP_MEMBERSHIP is always checked against memberships, but for the
      // list view we don't fetch memberships — elections with GROUP_MEMBERSHIP
      // restrictions are intentionally excluded from the list for non-members;
      // they can still be accessed directly if publicViewing=true)
      return checkRestrictions(e.restrictions, user);
    })
    .map((e) => {
      const isClosed = Date.now() > new Date(e.closesAt).getTime();
      const status = computeStatus(e.opensAt, e.closesAt);
      const isDeleted = !!e.deletedAt;

      const tallyResults = isClosed
        ? buildTallyResults(e.choices, e.ballotCount, e.winningConditions)
        : null;
      const tallyMap = new Map(tallyResults?.map((r) => [r.choiceId, r]));

      // Build choices with tally data, then apply shuffle if enabled
      let choices = e.choices.map((c) => {
        const base = { id: c.id, choice: c.choice, position: c.position };
        if (tallyResults) {
          const r = tallyMap.get(c.id);
          return { ...base, votes: r?.votes ?? 0, winner: r?.winner ?? false };
        }
        return base;
      });

      if (e.shuffleChoices) {
        choices = shuffleChoicesForUser(choices, user.sub, e.id);
      }

      const base: Election = {
        id: e.id,
        title: e.title,
        createdAt: e.createdAt,
        opensAt: e.opensAt,
        closesAt: e.closesAt,
        status,
        restrictions: e.restrictions,
        winningConditions: e.winningConditions,
        shuffleChoices: e.shuffleChoices,
        publicViewing: e.publicViewing,
        minChoices: e.minChoices,
        maxChoices: e.maxChoices,
        creator: e.creator,
        choices,
        ballotCount: e.ballotCount,
      };

      if (isAdmin && adminRecord && adminGraph) {
        const canDelete =
          !isDeleted &&
          adminCanDeleteElection(
            adminRecord,
            { restrictions: e.restrictions, created_by: e.createdBy },
            adminGraph,
          );
        const canRestore =
          isDeleted &&
          adminCanRestoreElection(
            adminRecord,
            { restrictions: e.restrictions, deletedByUserId: e.deletedByUserId },
            adminGraph,
          );
        return {
          ...base,
          deletedAt: e.deletedAt,
          deletedBy: e.deletedByUserId
            ? { userId: e.deletedByUserId, fullName: e.deletedByName ?? '' }
            : null,
          canDelete,
          canRestore,
        };
      }

      return base;
    });
}

// ---------------------------------------------------------------------------
// GET /api/elections
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/elections:
 *   get:
 *     summary: List elections visible to the caller
 *     description: >
 *       Returns all elections the caller is eligible to see, filtered by
 *       their faculty/group and admin status. Results are served from cache
 *       when available. For closed elections, choices include `votes` and
 *       `winner` fields. Deleted elections are included only for admin users.
 *       Status (`upcoming` | `open` | `closed`) is computed at response time.
 *       Winning conditions are NOT included in this response; use the detail
 *       endpoint to retrieve them.
 *     tags:
 *       - Elections
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of elections
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Election'
 *       401:
 *         description: Unauthorized
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);
  const { user } = auth;

  const isAdmin = user.isAdmin ?? false;

  let adminRecord: AdminContext | undefined;
  let adminGraph: Map<string, string | null> | undefined;

  if (isAdmin) {
    const dbAdmin = await prisma.admin.findUnique({
      where: { user_id: user.sub, deleted_at: null },
    });
    if (dbAdmin) {
      adminRecord = {
        user_id: dbAdmin.user_id,
        restricted_to_faculty: dbAdmin.restricted_to_faculty,
        faculty: dbAdmin.faculty,
      };
      adminGraph = await buildAdminGraph();
    }
  }

  const cached = await getCachedElections();

  if (cached) {
    return NextResponse.json(
      toClientElections(
        cached,
        {
          sub: user.sub,
          faculty: user.faculty,
          group: user.group,
          speciality: user.speciality,
          studyYear: user.studyYear,
          studyForm: user.studyForm,
          isAdmin,
          restrictedToFaculty: user.restrictedToFaculty,
        },
        adminRecord,
        adminGraph,
      ),
    );
  }

  const elections = await prisma.election.findMany({
    select: {
      id: true,
      title: true,
      created_at: true,
      opens_at: true,
      closes_at: true,
      min_choices: true,
      max_choices: true,
      created_by: true,
      restrictions: { select: { type: true, value: true } },
      public_key: true,
      private_key: true,
      winning_conditions: true,
      shuffle_choices: true,
      public_viewing: true,
      creator: { select: { full_name: true, faculty: true } },
      deleter: { select: { full_name: true } },
      choices: {
        select: { id: true, choice: true, position: true, vote_count: true },
        orderBy: { position: 'asc' },
      },
      _count: { select: { ballots: true } },
      deleted_at: true,
      deleted_by: true,
    },
    orderBy: { opens_at: 'desc' },
  });

  const rawResult: CachedElection[] = elections.map((e) => ({
    id: e.id,
    title: e.title,
    createdAt: e.created_at.toISOString(),
    opensAt: e.opens_at.toISOString(),
    closesAt: e.closes_at.toISOString(),
    minChoices: e.min_choices,
    maxChoices: e.max_choices,
    restrictions: e.restrictions as { type: RestrictionType; value: string }[],
    publicKey: e.public_key,
    privateKey: e.private_key,
    winningConditions: parseWinningConditions(e.winning_conditions),
    shuffleChoices: e.shuffle_choices,
    publicViewing: e.public_viewing,
    creator: { fullName: e.creator.full_name, faculty: e.creator.faculty },
    choices: e.choices.map((c) => ({
      id: c.id,
      choice: c.choice,
      position: c.position,
      voteCount: c.vote_count ?? null,
    })) as CachedElectionChoice[],
    ballotCount: e._count.ballots,
    createdBy: e.created_by,
    deletedAt: e.deleted_at?.toISOString() ?? null,
    deletedByUserId: e.deleted_by,
    deletedByName: e.deleter?.full_name ?? null,
  }));

  await setCachedElections(rawResult);

  return NextResponse.json(
    toClientElections(
      rawResult,
      {
        sub: user.sub,
        faculty: user.faculty,
        group: user.group,
        speciality: user.speciality,
        studyYear: user.studyYear,
        studyForm: user.studyForm,
        isAdmin,
        restrictedToFaculty: user.restrictedToFaculty,
      },
      adminRecord,
      adminGraph,
    ),
  );
}

// ---------------------------------------------------------------------------
// POST /api/elections
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/elections:
 *   post:
 *     summary: Create an election
 *     description: >
 *       Creates a new election with an auto-generated RSA key pair. The
 *       private key is encrypted with AES-256-GCM before being stored.
 *       Faculty and group values are validated against the campus API.
 *       Winning conditions are validated and stored; they affect how the
 *       winner is determined when tallying closed-election results.
 *       Requires admin authentication.
 *     tags:
 *       - Elections
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ElectionCreateBody'
 *     responses:
 *       201:
 *         description: Election created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Election'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – caller is not an admin
 *       500:
 *         description: Campus API unavailable for faculty/group validation
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return Errors.forbidden(auth.error);
  const { user, admin } = auth;

  let body: {
    title?: string;
    opensAt?: string;
    closesAt?: string;
    choices?: string[];
    minChoices?: number;
    maxChoices?: number;
    restrictions?: CreateElectionRestriction[];
    winningConditions?: unknown;
    shuffleChoices?: boolean;
    publicViewing?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { title, opensAt, closesAt, choices } = body;
  const minChoices = body.minChoices ?? ELECTION_MIN_CHOICES_MIN;
  const maxChoices = body.maxChoices ?? ELECTION_MIN_CHOICES_MIN;
  const restrictions: CreateElectionRestriction[] = body.restrictions ?? [];
  const shuffleChoices = body.shuffleChoices === true;
  const publicViewing =
    body.publicViewing === undefined ? !restrictions.length : body.publicViewing === true;

  // ── Basic validation ───────────────────────────────────────────────────────

  if (!title || !opensAt || !closesAt || !choices?.length) {
    return Errors.badRequest('title, opensAt, closesAt, choices are required');
  }
  if (!publicViewing && !restrictions.length) {
    return Errors.badRequest('publicViewing can not be false if no restrictions applied');
  }
  if (title.length > ELECTION_TITLE_MAX_LENGTH) {
    return Errors.badRequest(`Title must be at most ${ELECTION_TITLE_MAX_LENGTH} characters`);
  }
  if (choices.length < ELECTION_CHOICES_MIN) {
    if (ELECTION_CHOICES_MIN === 1) {
      return Errors.badRequest(`At least 1 choice is required`);
    }

    return Errors.badRequest(`At least ${ELECTION_CHOICES_MIN} choices are required`);
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
  const now = new Date();
  const maxCloseDate = Date.now() + ELECTION_MAX_CLOSES_AT_DAYS * 24 * 60 * 60 * 1000;

  if (isNaN(openDate.getTime())) return Errors.badRequest('Invalid opensAt date');
  if (isNaN(closeDate.getTime())) return Errors.badRequest('Invalid closesAt date');
  if (closeDate <= openDate) return Errors.badRequest('closesAt must be after opensAt');
  if (closeDate.getTime() > maxCloseDate) {
    return Errors.badRequest(
      `closesAt must be no more than ${ELECTION_MAX_CLOSES_AT_DAYS} days from now`,
    );
  }
  if (closeDate.getTime() <= now.getTime()) {
    return Errors.badRequest('closesAt must be in the future');
  }

  // ── Winning conditions ─────────────────────────────────────────────────────
  let winningConditionsRaw = body.winningConditions;
  if (typeof body === 'undefined') {
    if (choices.length === 1) {
      winningConditionsRaw = DEFAULT_WINNING_CONDITIONS_SINGLE_CHOICE;
    } else {
      winningConditionsRaw = DEFAULT_WINNING_CONDITIONS;
    }
  }

  const winningConditionsResult = validateWinningConditions(winningConditionsRaw, choices.length);
  if (typeof winningConditionsResult === 'string') {
    return Errors.badRequest(winningConditionsResult);
  }
  const winningConditions: WinningConditions = winningConditionsResult;

  // ── Restriction type / value validation ───────────────────────────────────
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
      return Errors.badRequest(
        `Unknown restriction type "${r.type}". Allowed types: ${[...VALID_RESTRICTION_TYPES].join(', ')}`,
      );
    }
    if (typeof r.value !== 'string' || !r.value.trim()) {
      return Errors.badRequest(`Restriction value must be a non-empty string (got "${r.value}")`);
    }
  }

  // ── Restriction validation ─────────────────────────────────────────────────
  const groupRestrictions = restrictions.filter((r) => r.type === 'GROUP');
  const facultyRestrictions = restrictions.filter((r) => r.type === 'FACULTY');
  const bypassRestrictions = restrictions.filter((r) => r.type === 'BYPASS_REQUIRED');
  const groupMembershipRestrictions = restrictions.filter((r) => r.type === 'GROUP_MEMBERSHIP');

  if (admin.restricted_to_faculty) {
    if (facultyRestrictions.length > 0) {
      // A FACULTY restriction is present — it must still be the admin's own faculty.
      if (facultyRestrictions.length > 1 || facultyRestrictions[0].value !== admin.faculty) {
        return Errors.badRequest(
          `Faculty-restricted admins may only restrict elections to their own faculty ("${admin.faculty}")`,
        );
      }
    } else if (groupMembershipRestrictions.length === 0) {
      // No FACULTY restriction and no GROUP_MEMBERSHIP bypass → reject.
      return Errors.badRequest(
        `Faculty-restricted admins must include a FACULTY restriction for their faculty ("${admin.faculty}"), unless at least one GROUP_MEMBERSHIP restriction is specified`,
      );
    }
    // else: no FACULTY restriction but GROUP_MEMBERSHIP is present → allowed.
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

  // Validate GROUP_MEMBERSHIP restriction values are real group UUIDs owned by this admin
  if (groupMembershipRestrictions.length > 0) {
    const groupIds = groupMembershipRestrictions.map((r) => r.value);
    const existingGroups = await prisma.group.findMany({
      where: { id: { in: groupIds }, deleted_at: null },
      select: { id: true, owner_id: true },
    });

    const existingIds = new Set(existingGroups.map((g) => g.id));
    for (const gid of groupIds) {
      if (!existingIds.has(gid)) {
        return Errors.badRequest(`Group "${gid}" does not exist or has been deleted`);
      }
    }

    // Only the group owner can use their group as a restriction
    // (unless the admin has manage_groups, in which case any group is valid)
    if (!admin.manage_groups) {
      for (const g of existingGroups) {
        if (g.owner_id !== admin.user_id) {
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
      return Errors.badRequest(
        `Graduate-level course restrictions are not permitted. Value "${r.value}" targets graduate students.`,
      );
    }
  }

  // Validate FACULTY / GROUP against campus API
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

  // ── Create election ────────────────────────────────────────────────────────
  const { publicKey, privateKey } = generateElectionKeyPair();
  const encryptedPrivateKey = encryptField(privateKey);

  const election = await prisma.election.create({
    data: {
      title,
      created_by: user.sub,
      created_at: now,
      opens_at: now > openDate ? now : openDate,
      closes_at: closeDate,
      min_choices: minChoices,
      max_choices: maxChoices,
      public_key: publicKey,
      private_key: encryptedPrivateKey,
      winning_conditions: winningConditions,
      shuffle_choices: shuffleChoices,
      public_viewing: publicViewing,
      choices: {
        create: choices.map((choice, i) => ({ choice, position: i })),
      },
      restrictions: {
        create: restrictions.map((r) => ({ type: r.type, value: r.value })),
      },
    },
    include: {
      choices: { orderBy: { position: 'asc' } },
      restrictions: { select: { type: true, value: true } },
    },
  });

  await invalidateElections();

  let responseChoices = election.choices.map((c) => ({
    id: c.id,
    choice: c.choice,
    position: c.position,
  }));
  if (shuffleChoices) {
    responseChoices = shuffleChoicesForUser(responseChoices, user.sub, election.id);
  }

  return NextResponse.json(
    {
      id: election.id,
      title: election.title,
      createdAt: election.created_at,
      opensAt: election.opens_at,
      closesAt: election.closes_at,
      minChoices: election.min_choices,
      maxChoices: election.max_choices,
      restrictions: election.restrictions,
      winningConditions,
      shuffleChoices,
      publicViewing,
      status: computeStatus(election.opens_at, election.closes_at),
      publicKey: election.public_key,
      creator: { fullName: admin.full_name, faculty: admin.faculty },
      choices: responseChoices,
      ballotCount: 0,
      deletedAt: null,
      deletedBy: null,
      canDelete: true,
      canRestore: false,
    },
    { status: 201 },
  );
}
