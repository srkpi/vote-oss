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

/**
 * @swagger
 * /api/elections/{id}/token:
 *   post:
 *     summary: Request a vote token
 *     description: >
 *       Issues a one-time, signed vote token to the authenticated user for
 *       the specified open election. Enforces faculty/group eligibility and
 *       prevents issuing more than one token per user per election.
 *
 *       After issuing the token the user's voted-elections cache is updated so
 *       the elections list page immediately reflects the new `voted` status
 *       without a DB round-trip on the next list request.
 *
 *       For non-anonymous elections the response also includes a `voterIdentity`
 *       object that the client must embed inside the v2 ballot envelope.
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
 *         description: Vote token issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: Unique vote token to be used when submitting a ballot
 *                 signature:
 *                   type: string
 *                   description: ECDSA signature of the token, verifiable with the election public key
 *                 voterIdentity:
 *                   type: object
 *                   nullable: true
 *                   description: >
 *                     Present only when the election is non-anonymous.
 *                     Must be embedded in the v2 ballot envelope.
 *                   required:
 *                     - userId
 *                     - fullName
 *                   properties:
 *                     userId:
 *                       type: string
 *                     fullName:
 *                       type: string
 *       400:
 *         description: Invalid UUID or election not open
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User not eligible
 *       404:
 *         description: Election not found
 *       409:
 *         description: Token already issued
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: electionId } = await params;
  if (!isValidUuid(electionId)) return Errors.badRequest('Invalid election id');

  const { user } = auth;
  const now = new Date();

  const election = await prisma.election.findUnique({
    where: { id: electionId, deleted_at: null },
    include: { restrictions: { select: { type: true, value: true } } },
  });
  if (!election) return Errors.notFound('Election not found');

  if (now < election.opens_at) return Errors.badRequest('Election has not started yet');
  if (now > election.closes_at) return Errors.badRequest('Election has already closed');

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
  if (existingToken) return Errors.conflict('Vote token already issued for this election');

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
