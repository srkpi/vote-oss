import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { getCachedElections } from '@/lib/cache';
import { decryptField } from '@/lib/encryption';
import { Errors } from '@/lib/errors';
import { getUserGroupMemberships } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { adminCanAccessElection, checkRestrictionsWithBypass } from '@/lib/restrictions';
import { isValidUuid } from '@/lib/utils/common';
import { shuffleChoicesForUser } from '@/lib/utils/shuffle-choices';
import type { ElectionRestriction } from '@/types/election';

/**
 * @swagger
 * /api/elections/{id}/ballots:
 *   get:
 *     summary: List all ballots for an election
 *     description: >
 *       Returns the full ordered ballot chain for the given election together
 *       with complete election metadata (status, choices, ballot count, and —
 *       for closed elections — the private key for client-side decryption).
 *
 *       The `anonymous` field on the returned election indicates whether voter
 *       identities are embedded in ballots.  When `false`, decrypting ballots
 *       on the client will reveal each voter's `userId` and `fullName`.
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
 *         description: Election metadata and ballot list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 election:
 *                   $ref: '#/components/schemas/ElectionForBallotsResponse'
 *                 ballots:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Ballot'
 *       400:
 *         description: Invalid election UUID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User is not eligible to view this election
 *       404:
 *         description: Election not found
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: electionId } = await params;
  if (!isValidUuid(electionId)) return Errors.badRequest('Invalid election id');

  // ── Fetch election ────────────────────────────────────────────────────────
  let electionData: {
    id: string;
    title: string;
    opens_at: Date;
    closes_at: Date;
    private_key: string;
    deleted_at: string | Date | null;
    restrictions: ElectionRestriction[];
    choices: { id: string; choice: string; position: number }[];
    min_choices: number;
    max_choices: number;
    shuffle_choices: boolean;
    public_viewing: boolean;
    anonymous: boolean;
  };

  const cached = await getCachedElections();
  if (cached) {
    const found = cached.find((e) => e.id === electionId);
    if (!found) return Errors.notFound('Election not found');

    electionData = {
      id: found.id,
      title: found.title,
      opens_at: new Date(found.opensAt),
      closes_at: new Date(found.closesAt),
      private_key: found.privateKey,
      deleted_at: found.deletedAt,
      restrictions: found.restrictions as ElectionRestriction[],
      choices: found.choices,
      min_choices: found.minChoices,
      max_choices: found.maxChoices,
      shuffle_choices: found.shuffleChoices ?? false,
      public_viewing: found.publicViewing ?? false,
      anonymous: found.anonymous ?? true,
    };
  } else {
    const dbElection = await prisma.election.findUnique({
      where: { id: electionId },
      select: {
        id: true,
        title: true,
        opens_at: true,
        closes_at: true,
        private_key: true,
        deleted_at: true,
        shuffle_choices: true,
        public_viewing: true,
        anonymous: true,
        restrictions: { select: { type: true, value: true } },
        choices: {
          select: { id: true, choice: true, position: true },
          orderBy: { position: 'asc' },
        },
        min_choices: true,
        max_choices: true,
      },
    });

    if (!dbElection) return Errors.notFound('Election not found');

    electionData = {
      ...dbElection,
      restrictions: dbElection.restrictions as ElectionRestriction[],
    };
  }

  const { user } = auth;

  // Deleted elections: non-admins see 404
  if (!user.isAdmin && electionData.deleted_at) return Errors.notFound('Election not found');

  const restrictions = electionData.restrictions;
  const { public_viewing: publicViewing } = electionData;

  // ── Access check ──────────────────────────────────────────────────────────
  // Admins (unrestricted): always allowed.
  // Admins (faculty-restricted): allowed if faculty matches, or publicViewing.
  // Regular users: allowed if they meet restrictions, or publicViewing.

  if (user.isAdmin && !user.restrictedToFaculty) {
    // unrestricted admin — pass
  } else if (user.isAdmin && user.restrictedToFaculty) {
    if (!adminCanAccessElection(user.faculty, restrictions) && !publicViewing) {
      return Errors.forbidden('You are not eligible to view this election');
    }
  } else {
    // Regular user path
    const hasGroupMembershipRestriction = restrictions.some((r) => r.type === 'GROUP_MEMBERSHIP');
    const groupMemberships = hasGroupMembershipRestriction
      ? await getUserGroupMemberships(user.sub)
      : null;

    const eligible = checkRestrictionsWithBypass(restrictions, user, null, groupMemberships);

    if (!eligible && !publicViewing) {
      return Errors.forbidden('You are not eligible to view this election');
    }
  }

  // ── Fetch ballots ─────────────────────────────────────────────────────────
  const now = new Date();
  const isClosed = now > electionData.closes_at;
  const status =
    now < electionData.opens_at ? 'upcoming' : now <= electionData.closes_at ? 'open' : 'closed';

  const ballots = await prisma.ballot.findMany({
    where: { election_id: electionId },
    select: {
      id: true,
      encrypted_ballot: true,
      created_at: true,
      signature: true,
      previous_hash: true,
      current_hash: true,
    },
    orderBy: { created_at: 'asc' },
  });

  let choices = electionData.choices.map((c) => ({
    id: c.id,
    choice: c.choice,
    position: c.position,
  }));

  // Only shuffle for users who can actually vote (not for public observers)
  const hasGroupMembershipRestriction = restrictions.some((r) => r.type === 'GROUP_MEMBERSHIP');
  const groupMembershipsForShuffle = hasGroupMembershipRestriction
    ? await getUserGroupMemberships(user.sub)
    : null;
  const userCanVote = user.isAdmin
    ? true
    : checkRestrictionsWithBypass(restrictions, user, null, groupMembershipsForShuffle);

  if (electionData.shuffle_choices && userCanVote) {
    choices = shuffleChoicesForUser(choices, user.sub, electionId);
  }

  return NextResponse.json({
    election: {
      id: electionData.id,
      title: electionData.title,
      opensAt: electionData.opens_at,
      closesAt: electionData.closes_at,
      status,
      ballotCount: ballots.length,
      deletedAt: electionData.deleted_at,
      shuffleChoices: electionData.shuffle_choices,
      publicViewing,
      anonymous: electionData.anonymous,
      choices,
      minChoices: electionData.min_choices,
      maxChoices: electionData.max_choices,
      ...(isClosed && { privateKey: decryptField(electionData.private_key) }),
    },
    ballots: ballots.map((b) => ({
      id: b.id,
      encryptedBallot: b.encrypted_ballot,
      createdAt: b.created_at.toISOString(),
      signature: b.signature,
      previousHash: b.previous_hash,
      currentHash: b.current_hash,
    })),
  });
}
