import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { getElectionBypassForUser } from '@/lib/bypass';
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
 *       400:
 *         description: Invalid UUID or election not open
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User is not eligible for this election (faculty or group restriction)
 *       404:
 *         description: Election not found
 *       409:
 *         description: Vote token already issued for this user/election pair
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

  return NextResponse.json({ token, signature }, { status: 200 });
}
