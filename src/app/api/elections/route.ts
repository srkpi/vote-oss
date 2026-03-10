import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin, requireAuth } from '@/lib/auth';
import { generateElectionKeyPair } from '@/lib/crypto';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

// GET /api/elections
// Returns elections visible to the requesting user (respects faculty/group restrictions)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { user } = auth;
  const now = new Date();

  const elections = await prisma.election.findMany({
    where: {
      AND: [
        {
          OR: [{ restricted_to_faculty: null }, { restricted_to_faculty: user.faculty }],
        },
        {
          OR: [{ restricted_to_group: null }, { restricted_to_group: user.group }],
        },
      ],
    },
    select: {
      id: true,
      title: true,
      created_at: true,
      opens_at: true,
      closes_at: true,
      restricted_to_faculty: true,
      restricted_to_group: true,
      public_key: true,
      // private_key exposed only after election closes
      private_key: true,
      creator: { select: { full_name: true, faculty: true } },
      choices: { select: { id: true, choice: true, position: true }, orderBy: { position: 'asc' } },
      _count: { select: { ballots: true } },
    },
    orderBy: { opens_at: 'desc' },
  });

  const result = elections.map((e) => ({
    id: e.id,
    title: e.title,
    createdAt: e.created_at,
    opensAt: e.opens_at,
    closesAt: e.closes_at,
    restrictedToFaculty: e.restricted_to_faculty,
    restrictedToGroup: e.restricted_to_group,
    publicKey: e.public_key,
    privateKey: now > e.closes_at ? e.private_key : undefined,
    status: now < e.opens_at ? 'upcoming' : now <= e.closes_at ? 'open' : 'closed',
    creator: e.creator,
    choices: e.choices,
    ballotCount: e._count.ballots,
  }));

  return NextResponse.json(result);
}

// POST /api/elections
// Admin only – create an election with choices
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
  if (choices.length < 2) {
    return Errors.badRequest('At least 2 choices are required');
  }

  const openDate = new Date(opensAt);
  const closeDate = new Date(closesAt);

  if (isNaN(openDate.getTime()) || isNaN(closeDate.getTime())) {
    return Errors.badRequest('Invalid date format for opensAt or closesAt');
  }
  if (closeDate <= openDate) {
    return Errors.badRequest('closesAt must be after opensAt');
  }

  // Enforce faculty restriction for restricted admins
  if (admin.restricted_to_faculty) {
    restrictedToFaculty = admin.faculty;
  }

  const { publicKey, privateKey } = generateElectionKeyPair();

  const election = await prisma.election.create({
    data: {
      title,
      created_by: user?.sub,
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
