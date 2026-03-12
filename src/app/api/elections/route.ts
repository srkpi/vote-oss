import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin, requireAuth } from '@/lib/auth';
import {
  type CachedElection,
  getCachedElections,
  invalidateElections,
  setCachedElections,
} from '@/lib/cache';
import {
  ELECTION_CHOICE_MAX_LENGTH,
  ELECTION_CHOICES_MAX,
  ELECTION_CHOICES_MIN,
  ELECTION_TITLE_MAX_LENGTH,
} from '@/lib/constants';
import { generateElectionKeyPair } from '@/lib/crypto';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import type { Election, ElectionStatus } from '@/types/election';

function computeStatus(opensAt: string, closesAt: string): ElectionStatus {
  const now = Date.now();
  const open = new Date(opensAt).getTime();
  const close = new Date(closesAt).getTime();
  if (now < open) return 'upcoming';
  if (now <= close) return 'open';
  return 'closed';
}

/**
 * Apply per-user filtering (faculty / group restrictions) and attach the
 * live `status` and conditionally expose `privateKey`.
 */
function toClientElections(cached: CachedElection[], faculty: string, group: string): Election[] {
  const now = Date.now();
  return cached
    .filter(
      (e) =>
        (!e.restrictedToFaculty || e.restrictedToFaculty === faculty) &&
        (!e.restrictedToGroup || e.restrictedToGroup === group),
    )
    .map((e) => ({
      ...e,
      status: computeStatus(e.opensAt, e.closesAt),
      // Only expose the private key after the election has closed
      privateKey: now > new Date(e.closesAt).getTime() ? e.privateKey : undefined,
    }));
}

// ---------------------------------------------------------------------------
// GET /api/elections
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { user } = auth;

  const cached = await getCachedElections();
  if (cached) {
    return NextResponse.json(toClientElections(cached, user.faculty, user.group));
  }

  const elections = await prisma.election.findMany({
    select: {
      id: true,
      title: true,
      created_at: true,
      opens_at: true,
      closes_at: true,
      restricted_to_faculty: true,
      restricted_to_group: true,
      public_key: true,
      private_key: true,
      creator: { select: { full_name: true, faculty: true } },
      choices: {
        select: { id: true, choice: true, position: true },
        orderBy: { position: 'asc' },
      },
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
    restrictedToFaculty: e.restricted_to_faculty,
    restrictedToGroup: e.restricted_to_group,
    publicKey: e.public_key,
    privateKey: e.private_key,
    creator: e.creator,
    choices: e.choices,
    ballotCount: e._count.ballots,
  }));

  await setCachedElections(rawResult);

  return NextResponse.json(toClientElections(rawResult, user.faculty, user.group));
}

// ---------------------------------------------------------------------------
// POST /api/elections
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return Errors.forbidden(auth.error);

  const { user, admin } = auth;

  let body: {
    title?: string;
    opensAt?: string;
    closesAt?: string;
    restrictedToFaculty?: string | null;
    restrictedToGroup?: string | null;
    choices?: string[];
  };

  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { title, opensAt, closesAt, choices } = body;
  let restrictedToFaculty = body.restrictedToFaculty;

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

  const openDate = new Date(opensAt);
  const closeDate = new Date(closesAt);

  if (isNaN(openDate.getTime()) || isNaN(closeDate.getTime())) {
    return Errors.badRequest('Invalid date format for opensAt or closesAt');
  }
  if (closeDate <= openDate) {
    return Errors.badRequest('closesAt must be after opensAt');
  }

  if (admin.restricted_to_faculty) {
    restrictedToFaculty = admin.faculty;
  }

  const { publicKey, privateKey } = generateElectionKeyPair();

  const election = await prisma.election.create({
    data: {
      title,
      created_by: user.sub,
      created_at: new Date(),
      opens_at: openDate,
      closes_at: closeDate,
      restricted_to_faculty: restrictedToFaculty ?? null,
      restricted_to_group: body.restrictedToGroup ?? null,
      public_key: publicKey,
      private_key: privateKey,
      choices: {
        create: choices.map((choice, i) => ({ choice, position: i })),
      },
    },
    include: {
      choices: { orderBy: { position: 'asc' } },
    },
  });

  await invalidateElections();

  return NextResponse.json(
    {
      id: election.id,
      title: election.title,
      opensAt: election.opens_at,
      closesAt: election.closes_at,
      publicKey: election.public_key,
      choices: election.choices.map((c) => ({ id: c.id, choice: c.choice, position: c.position })),
    },
    { status: 201 },
  );
}
