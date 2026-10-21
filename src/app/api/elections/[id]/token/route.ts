import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { getElectionBypassForUser } from '@/lib/bypass';
import { addToUserVotedElections } from '@/lib/cache';
import { generateVoteToken, signVoteToken } from '@/lib/crypto';
import { decryptField } from '@/lib/encryption';
import { Errors } from '@/lib/errors';
import { getUserGroupMemberships } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { checkRestrictionsWithBypass } from '@/lib/restrictions';
import { isValidUuid } from '@/lib/utils/common';
import type { ElectionRestriction } from '@/types/election';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return Errors.unauthorized(auth.error);
  }

  const { id: electionId } = await params;
  if (!isValidUuid(electionId)) {
    return Errors.badRequest('Invalid election id');
  }

  const { user } = auth;
  const now = new Date();

  const election = await prisma.election.findUnique({
    where: { id: electionId, deleted_at: null },
    include: { restrictions: { select: { type: true, value: true } } },
  });
  if (!election) {
    return Errors.notFound('Election not found');
  }

  if (now < election.opens_at) {
    return Errors.badRequest('Election has not started yet');
  }
  if (now > election.closes_at) {
    return Errors.badRequest('Election has already closed');
  }

  const restrictions = election.restrictions as ElectionRestriction[];

  const hasGroupMembershipRestriction = restrictions.some((r) => r.type === 'GROUP_MEMBERSHIP');
  const [bypassedTypes, groupMemberships] = await Promise.all([
    getElectionBypassForUser(user.sub, electionId),
    hasGroupMembershipRestriction ? getUserGroupMemberships(user.sub) : Promise.resolve(null),
  ]);

  if (!checkRestrictionsWithBypass(restrictions, user, bypassedTypes, groupMemberships)) {
    return Errors.forbidden('You are not eligible for this election');
  }

  const existingToken = await prisma.issuedToken.findUnique({
    where: { election_id_user_id: { election_id: electionId, user_id: user.sub } },
  });
  if (existingToken) {
    return Errors.conflict('Vote token already issued for this election');
  }

  const { token } = generateVoteToken(electionId);

  const privateKeyPem = decryptField(election.private_key);
  const signature = signVoteToken(privateKeyPem, token);

  await prisma.issuedToken.create({ data: { election_id: electionId, user_id: user.sub } });

  // ── Warm the voted-elections cache so the list page shows "voted" immediately ──
  // Fire-and-forget: a Redis error here is non-fatal; the list endpoint will
  // re-derive the voted status from IssuedToken on the next request.
  addToUserVotedElections(user.sub, electionId).catch(() => {
    /* non-fatal */
  });

  const voterIdentity = election.anonymous
    ? undefined
    : { userId: user.sub, fullName: user.fullName };

  return NextResponse.json({ token, signature, voterIdentity }, { status: 200 });
}
