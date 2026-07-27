import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { getCachedElections } from '@/lib/cache';
import { decryptField } from '@/lib/encryption';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';
import type { BallotsElection, BallotsResponse } from '@/types/ballot';
import type { CachedElection } from '@/types/election';

/**
 * @swagger
 * /api/elections/{id}/signatories:
 *   get:
 *     summary: Get a petition's private key and ballot chain for the Supporters/Analytics tabs
 *     description: >
 *       Returns the same shape as GET /api/elections/{id}/ballots so the
 *       petition detail page can feed its Supporters tab and its Analytics
 *       tab (charts + CSV export) from one fetch, reusing the election
 *       analytics components.
 *
 *       Petitions are non-anonymous by design, so the private key is
 *       exposed regardless of whether the petition is still open or
 *       already closed.
 *
 *       Visibility rules:
 *         - Approved petitions: any authenticated user who can see the petition.
 *         - Unapproved petitions: admins with manage_petitions or the petition's creator.
 *         - Deleted petitions: admins only.
 *
 *       This endpoint is petition-exclusive. Calling it with a regular
 *       election ID returns 400.
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
 *         description: Petition UUID
 *     responses:
 *       200:
 *         description: Petition metadata, private key, and ballot chain
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BallotsResponse'
 *       400:
 *         description: Invalid UUID, or the resource is not a petition
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: >
 *           Petition not found; also returned for unapproved petitions when
 *           the caller is not the creator and does not have
 *           manage_petitions; and for soft-deleted petitions when the
 *           caller is not an admin.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: electionId } = await params;
  if (!isValidUuid(electionId)) return Errors.badRequest('Invalid election id');

  const { user } = auth;
  const isAdmin = user.isAdmin ?? false;

  const cached = await getCachedElections();
  let electionRow = cached?.find((e) => e.id === electionId) ?? null;

  if (!electionRow) {
    const db = await prisma.election.findUnique({
      where: { id: electionId },
      select: {
        id: true,
        type: true,
        title: true,
        approved: true,
        created_by: true,
        private_key: true,
        public_key: true,
        opens_at: true,
        closes_at: true,
        deleted_at: true,
        public_viewing: true,
        min_choices: true,
        max_choices: true,
      },
    });
    if (!db) return Errors.notFound('Petition not found');
    electionRow = {
      id: db.id,
      type: db.type,
      title: db.title,
      approved: db.approved,
      createdBy: db.created_by,
      privateKey: db.private_key,
      publicKey: db.public_key,
      opensAt: db.opens_at.toISOString(),
      closesAt: db.closes_at.toISOString(),
      deletedAt: db.deleted_at ? db.deleted_at.toISOString() : null,
      publicViewing: db.public_viewing,
      minChoices: db.min_choices,
      maxChoices: db.max_choices,
      // fields below are populated after the type/visibility checks
    } as CachedElection;
  }

  if (electionRow.type !== 'PETITION') {
    return Errors.badRequest('Signatories are only available for petitions');
  }
  if (!isAdmin && electionRow.deletedAt) return Errors.notFound('Petition not found');
  if (!electionRow.approved) {
    const isPetitionManager = isAdmin && user.managePetitions === true;
    if (!isPetitionManager && electionRow.createdBy !== user.sub)
      return Errors.notFound('Petition not found');
  }

  const [ballots, choices, ballotCount] = await Promise.all([
    prisma.ballot.findMany({
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
    }),
    prisma.electionChoice.findMany({
      where: { election_id: electionId },
      select: { id: true, choice: true, position: true },
      orderBy: { position: 'asc' },
    }),
    prisma.ballot.count({ where: { election_id: electionId } }),
  ]);

  const election: BallotsElection = {
    id: electionRow.id,
    title: electionRow.title,
    opensAt: electionRow.opensAt,
    closesAt: electionRow.closesAt,
    status: 'open',
    ballotCount,
    choices,
    privateKey: decryptField(electionRow.privateKey),
    deletedAt: electionRow.deletedAt,
    shuffleChoices: electionRow.shuffleChoices,
    publicViewing: electionRow.publicViewing,
    anonymous: electionRow.anonymous,
    minChoices: electionRow.minChoices,
    maxChoices: electionRow.maxChoices,
  };

  const response: BallotsResponse = {
    election,
    ballots: ballots.map((b) => ({
      id: b.id,
      encryptedBallot: b.encrypted_ballot,
      createdAt: b.created_at.toISOString(),
      signature: b.signature,
      previousHash: b.previous_hash,
      currentHash: b.current_hash,
    })),
    total: ballotCount,
  };

  return NextResponse.json(response);
}
