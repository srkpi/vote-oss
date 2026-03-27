import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin, requireAuth } from '@/lib/auth';
import { getCachedElections, invalidateElections, setCachedElections } from '@/lib/cache';
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
} from '@/lib/constants';
import { generateElectionKeyPair } from '@/lib/crypto';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { adminCanAccessElection, checkRestrictions } from '@/lib/restrictions';
import type {
  CachedElection,
  CreateElectionRestriction,
  Election,
  ElectionStatus,
  RestrictionType,
} from '@/types/election';

function computeStatus(opensAt: string, closesAt: string): ElectionStatus {
  const now = Date.now();
  const open = new Date(opensAt).getTime();
  const close = new Date(closesAt).getTime();
  if (now < open) return 'upcoming';
  if (now <= close) return 'open';
  return 'closed';
}

function toClientElections(
  cached: CachedElection[],
  user: {
    faculty: string;
    group: string;
    speciality?: string;
    studyYear?: number;
    studyForm?: string;
    isAdmin?: boolean;
    restrictedToFaculty?: boolean;
  },
): Election[] {
  const now = Date.now();
  const isAdmin = user.isAdmin ?? false;
  const isAdminRestricted = user.restrictedToFaculty ?? true;

  return cached
    .filter((e) => {
      if (isAdmin && !isAdminRestricted) return true;
      if (isAdmin && isAdminRestricted) return adminCanAccessElection(user.faculty, e.restrictions);
      return checkRestrictions(e.restrictions, user);
    })
    .map((e) => ({
      ...e,
      status: computeStatus(e.opensAt, e.closesAt),
      privateKey: now > new Date(e.closesAt).getTime() ? e.privateKey : undefined,
    }));
}

/**
 * @swagger
 * /api/elections:
 *   get:
 *     summary: List elections visible to the caller
 *     description: >
 *       Returns all elections the caller is eligible to see, filtered by
 *       their faculty/group and admin status. Results are served from cache
 *       when available. The private key is included only for closed elections.
 *       Status (`upcoming` | `open` | `closed`) is computed at response time.
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

  const cached = await getCachedElections();
  if (cached) {
    return NextResponse.json(
      toClientElections(cached, {
        faculty: user.faculty,
        group: user.group,
        speciality: user.speciality,
        studyYear: user.studyYear,
        studyForm: user.studyForm,
        isAdmin: user.isAdmin,
        restrictedToFaculty: user.restrictedToFaculty,
      }),
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
      restrictions: { select: { type: true, value: true } },
      public_key: true,
      private_key: true,
      creator: { select: { full_name: true, faculty: true } },
      choices: { select: { id: true, choice: true, position: true }, orderBy: { position: 'asc' } },
      _count: { select: { ballots: true } },
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
    creator: { fullName: e.creator.full_name, faculty: e.creator.faculty },
    choices: e.choices,
    ballotCount: e._count.ballots,
  }));

  await setCachedElections(rawResult);

  return NextResponse.json(
    toClientElections(rawResult, {
      faculty: user.faculty,
      group: user.group,
      speciality: user.speciality,
      studyYear: user.studyYear,
      studyForm: user.studyForm,
      isAdmin: user.isAdmin,
      restrictedToFaculty: user.restrictedToFaculty,
    }),
  );
}

/**
 * @swagger
 * /api/elections:
 *   post:
 *     summary: Create an election
 *     description: >
 *       Creates a new election with an auto-generated RSA key pair. The
 *       `opensAt` date is clamped to `now` if it is in the past. Faculty and
 *       group values are validated against the campus API. Faculty-restricted
 *       admins may only create elections for their own faculty. Requires admin
 *       authentication.
 *     tags:
 *       - Elections
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - opensAt
 *               - closesAt
 *               - choices
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 255
 *               opensAt:
 *                 type: string
 *                 format: date-time
 *               closesAt:
 *                 type: string
 *                 format: date-time
 *               choices:
 *                 type: array
 *                 minItems: 2
 *                 maxItems: 10
 *                 items:
 *                   type: string
 *                   maxLength: 100
 *               restrictedToFaculty:
 *                 type: string
 *                 nullable: true
 *                 description: Limit election to a specific faculty (null = all faculties)
 *               restrictedToGroup:
 *                 type: string
 *                 nullable: true
 *                 description: Limit election to a specific group within the faculty
 *     responses:
 *       201:
 *         description: Election created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 title:
 *                   type: string
 *                 opensAt:
 *                   type: string
 *                   format: date-time
 *                 closesAt:
 *                   type: string
 *                   format: date-time
 *                 publicKey:
 *                   type: string
 *                 choices:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       choice:
 *                         type: string
 *                       position:
 *                         type: integer
 *       400:
 *         description: Validation error (missing fields, date constraints, unknown faculty/group)
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
  };

  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { title, opensAt, closesAt, choices } = body;
  const minChoices = body.minChoices ?? 1;
  const maxChoices = body.maxChoices ?? 1;
  let restrictions: CreateElectionRestriction[] = body.restrictions ?? [];

  if (!title || !opensAt || !closesAt || !choices?.length) {
    return Errors.badRequest('title, opensAt, closesAt, choices are required');
  }
  if (title.length > ELECTION_TITLE_MAX_LENGTH) {
    return Errors.badRequest(`Title must be at most ${ELECTION_TITLE_MAX_LENGTH} characters`);
  }
  if (choices.length < ELECTION_CHOICES_MIN) {
    return Errors.badRequest(`At least ${ELECTION_CHOICES_MIN} choices are required`);
  }
  if (choices.length > ELECTION_CHOICES_MAX) {
    return Errors.badRequest(`At most ${ELECTION_CHOICES_MAX} choices are allowed`);
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
    return Errors.badRequest('maxChoices must be greater than or equal to minChoices');
  }
  if (maxChoices > choices.length) {
    return Errors.badRequest('maxChoices cannot exceed the number of choices');
  }

  const openDate = new Date(opensAt);
  const closeDate = new Date(closesAt);
  const maxCloseDate = Date.now() + ELECTION_MAX_CLOSES_AT_DAYS * 24 * 60 * 60 * 1000;

  if (isNaN(openDate.getTime())) return Errors.badRequest('Invalid date format for opensAt');
  if (isNaN(closeDate.getTime())) return Errors.badRequest('Invalid date format for closesAt');
  if (closeDate <= openDate) return Errors.badRequest('closesAt must be after opensAt');
  if (closeDate.getTime() > maxCloseDate) {
    return Errors.badRequest(
      `closesAt must be no more than ${ELECTION_MAX_CLOSES_AT_DAYS} days from current date`,
    );
  }

  // Faculty-restricted admin: force FACULTY restriction to their faculty
  if (admin.restricted_to_faculty) {
    restrictions = restrictions.filter((r) => r.type !== 'FACULTY');
    restrictions.push({ type: 'FACULTY', value: admin.faculty });
  }

  // Validate restrictions
  const groupRestrictions = restrictions.filter((r) => r.type === 'GROUP');
  const facultyRestrictions = restrictions.filter((r) => r.type === 'FACULTY');

  if (groupRestrictions.length > 0 && facultyRestrictions.length === 0) {
    return Errors.badRequest('GROUP restrictions require at least one FACULTY restriction');
  }

  // Validate STUDY_YEAR values
  for (const r of restrictions.filter((r) => r.type === 'STUDY_YEAR')) {
    const year = Number(r.value);
    if (!STUDY_YEARS.includes(year as StudyYearValue)) {
      return Errors.badRequest(
        `Invalid study year "${r.value}". Must be one of: ${STUDY_YEARS.join(', ')}`,
      );
    }
  }

  // Validate STUDY_FORM values
  for (const r of restrictions.filter((r) => r.type === 'STUDY_FORM')) {
    if (!STUDY_FORMS.includes(r.value as StudyFormValue)) {
      return Errors.badRequest(
        `Invalid study form "${r.value}". Must be one of: ${STUDY_FORMS.join(', ')}`,
      );
    }
  }

  // Validate FACULTY and GROUP values via campus API
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

    for (const r of groupRestrictions) {
      const validFaculties = facultyRestrictions.map((f) => f.value);
      const groupExistsInFaculty = validFaculties.some((f) =>
        (facultyGroups[f] ?? []).includes(r.value),
      );
      if (!groupExistsInFaculty) {
        return Errors.badRequest(`Group "${r.value}" does not exist in the specified faculties`);
      }
    }
  }

  const { publicKey, privateKey } = generateElectionKeyPair();
  const now = new Date();

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
      private_key: privateKey,
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

  return NextResponse.json(
    {
      id: election.id,
      title: election.title,
      opensAt: election.opens_at,
      closesAt: election.closes_at,
      minChoices: election.min_choices,
      maxChoices: election.max_choices,
      publicKey: election.public_key,
      choices: election.choices.map((c) => ({ id: c.id, choice: c.choice, position: c.position })),
      restrictions: election.restrictions,
    },
    { status: 201 },
  );
}
