import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { getCachedElections } from '@/lib/cache';
import { decryptField } from '@/lib/encryption';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';

/**
 * @swagger
 * /api/elections/{id}/signatories:
 *   get:
 *     summary: Get the petition's private key and raw ballot envelopes for signatory verification
 *     description: >
 *       Returns the petition's RSA private key together with the raw encrypted
 *       ballot envelopes so the browser can decrypt voter identities client-side
 *       and verify the integrity of the ballot chain.
 *
 *       Petitions are non-anonymous by design, so the private key is exposed
 *       regardless of whether the petition is still open or already closed.
 *
 *       Visibility rules:
 *         - Approved petitions: any authenticated user who can see the petition.
 *         - Unapproved petitions: admins with manage_petitions or the petition's creator.
 *         - Deleted petitions: admins only.
 *
 *       This endpoint is petition-exclusive. Calling it with a regular election
 *       ID returns 400.
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
 *         description: Petition private key and ballot chain
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - petition
 *                 - ballots
 *               properties:
 *                 petition:
 *                   type: object
 *                   required:
 *                     - id
 *                     - privateKey
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     privateKey:
 *                       type: string
 *                       description: PEM-encoded RSA private key for decrypting ballot envelopes.
 *                 ballots:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Ballot'
 *       400:
 *         description: Invalid UUID, or the resource is not a petition
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: >
 *           Petition not found; also returned for unapproved petitions when the
 *           caller is not the creator and does not have manage_petitions; and
 *           for soft-deleted petitions when the caller is not an admin.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: electionId } = await params;
  if (!isValidUuid(electionId)) return Errors.badRequest('Invalid election id');

  const { user } = auth;
  const isAdmin = user.isAdmin ?? false;

  const cached = await getCachedElections();
  let electionData: {
    type: string;
    approved: boolean;
    createdBy: string;
    privateKey: string;
    deletedAt: string | Date | null;
  } | null = null;

  if (cached) {
    const found = cached.find((e) => e.id === electionId);
    if (found) {
      electionData = {
        type: found.type,
        approved: found.approved,
        createdBy: found.createdBy,
        privateKey: found.privateKey,
        deletedAt: found.deletedAt,
      };
    }
  }

  if (!electionData) {
    const db = await prisma.election.findUnique({
      where: { id: electionId },
      select: {
        type: true,
        approved: true,
        created_by: true,
        private_key: true,
        deleted_at: true,
      },
    });
    if (!db) return Errors.notFound('Petition not found');
    electionData = {
      type: db.type,
      approved: db.approved,
      createdBy: db.created_by,
      privateKey: db.private_key,
      deletedAt: db.deleted_at,
    };
  }

  if (electionData.type !== 'PETITION') {
    return Errors.badRequest('Signatories are only available for petitions');
  }

  if (!isAdmin && electionData.deletedAt) {
    return Errors.notFound('Petition not found');
  }

  if (!electionData.approved) {
    const isPetitionManager = isAdmin && user.managePetitions === true;
    if (!isPetitionManager && electionData.createdBy !== user.sub) {
      return Errors.notFound('Petition not found');
    }
  }

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

  return NextResponse.json({
    petition: {
      id: electionId,
      privateKey: decryptField(electionData.privateKey),
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
