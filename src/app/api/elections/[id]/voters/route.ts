import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { getCachedElections } from '@/lib/cache';
import { decryptBallot } from '@/lib/crypto';
import { decryptField } from '@/lib/encryption';
import { Errors } from '@/lib/errors';
import { getUserGroupMemberships } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { adminCanAccessElection, checkRestrictionsWithBypass } from '@/lib/restrictions';
import { isValidUuid } from '@/lib/utils/common';
import type { ElectionRestriction } from '@/types/election';

/**
 * @swagger
 * /api/elections/{id}/voters:
 *   get:
 *     summary: Decrypted voter list for a non-anonymous election
 *     description: >
 *       Returns the unique list of voter identities (`userId`, `fullName`)
 *       extracted from v2 (identified) ballot envelopes.
 *
 *       Available only for non-anonymous, closed elections — for anonymous
 *       ballots the server has no voter mapping to disclose, and during an
 *       open election we still hide who-voted-for-what.  For non-anonymous
 *       open elections, the list of voters (without their choices) is
 *       returned because it is essentially public anyway.
 *     tags: [Elections]
 *     security:
 *       - cookieAuth: []
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: electionId } = await params;
  if (!isValidUuid(electionId)) return Errors.badRequest('Invalid election id');

  // Reuse the same access model as /ballots — admins, eligible users, or
  // public-viewing observers may read.
  let electionData: {
    id: string;
    opens_at: Date;
    closes_at: Date;
    private_key: string;
    deleted_at: string | Date | null;
    restrictions: ElectionRestriction[];
    anonymous: boolean;
    public_viewing: boolean;
  };

  const cached = await getCachedElections();
  if (cached) {
    const found = cached.find((e) => e.id === electionId);
    if (!found) return Errors.notFound('Election not found');
    electionData = {
      id: found.id,
      opens_at: new Date(found.opensAt),
      closes_at: new Date(found.closesAt),
      private_key: found.privateKey,
      deleted_at: found.deletedAt,
      restrictions: found.restrictions as ElectionRestriction[],
      anonymous: found.anonymous ?? true,
      public_viewing: found.publicViewing ?? false,
    };
  } else {
    const dbElection = await prisma.election.findUnique({
      where: { id: electionId },
      select: {
        id: true,
        opens_at: true,
        closes_at: true,
        private_key: true,
        deleted_at: true,
        anonymous: true,
        public_viewing: true,
        restrictions: { select: { type: true, value: true } },
      },
    });
    if (!dbElection) return Errors.notFound('Election not found');
    electionData = {
      ...dbElection,
      restrictions: dbElection.restrictions as ElectionRestriction[],
    };
  }

  const { user } = auth;

  if (!user.isAdmin && electionData.deleted_at) return Errors.notFound('Election not found');

  if (electionData.anonymous) {
    return Errors.badRequest('This election is anonymous — voter identities are not available');
  }

  const now = new Date();
  const isClosed = now > electionData.closes_at;
  const isOpen = now >= electionData.opens_at && now <= electionData.closes_at;
  if (!isClosed && !isOpen) {
    return Errors.badRequest('Election has not started yet');
  }

  const { public_viewing: publicViewing } = electionData;

  // Access check (mirrors /ballots)
  if (user.isAdmin && !user.restrictedToFaculty) {
    // unrestricted admin — pass
  } else if (user.isAdmin && user.restrictedToFaculty) {
    if (!adminCanAccessElection(user.faculty, electionData.restrictions) && !publicViewing) {
      return Errors.forbidden('You are not eligible to view this election');
    }
  } else {
    const hasGroupMembershipRestriction = electionData.restrictions.some(
      (r) => r.type === 'GROUP_MEMBERSHIP',
    );
    const groupMemberships = hasGroupMembershipRestriction
      ? await getUserGroupMemberships(user.sub)
      : null;
    const eligible = checkRestrictionsWithBypass(
      electionData.restrictions,
      user,
      null,
      groupMemberships,
    );
    if (!eligible && !publicViewing) {
      return Errors.forbidden('You are not eligible to view this election');
    }
  }

  // Decrypt ballots and aggregate unique voter identities.
  const privateKeyPem = decryptField(electionData.private_key);

  const ballots = await prisma.ballot.findMany({
    where: { election_id: electionId },
    select: { encrypted_ballot: true },
  });

  const seen = new Map<string, { userId: string; fullName: string }>();
  for (const b of ballots) {
    try {
      const { voter } = decryptBallot(privateKeyPem, b.encrypted_ballot);
      if (voter && !seen.has(voter.userId)) {
        seen.set(voter.userId, voter);
      }
    } catch {
      // Skip malformed envelopes — anonymous-encrypted ballots in a
      // non-anonymous election shouldn't happen, but be defensive.
    }
  }

  return NextResponse.json({ voters: Array.from(seen.values()) });
}
