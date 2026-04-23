import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { getCachedElections } from '@/lib/cache';
import { decryptBallot } from '@/lib/crypto';
import { decryptField } from '@/lib/encryption';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';

/**
 * GET /api/elections/[id]/signatories
 *
 * Returns the list of users who have signed a petition.  Only applicable to
 * PETITION-type elections, which are always non-anonymous and carry voter
 * identity inside their encrypted envelope.  The server decrypts each ballot
 * with the stored private key and returns the voter identities.
 *
 * Visibility mirrors the detail endpoint:
 *   - approved petitions: any authenticated user who can see the petition
 *   - unapproved petitions: manage_petitions admins only
 *   - deleted petitions: admins only
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: electionId } = await params;
  if (!isValidUuid(electionId)) return Errors.badRequest('Invalid election id');

  const { user } = auth;
  const isAdmin = user.isAdmin ?? false;

  // Load election (cache-first for key + type, fall back to DB)
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

  const privateKeyPem = decryptField(electionData.privateKey);

  const ballots = await prisma.ballot.findMany({
    where: { election_id: electionId },
    select: { encrypted_ballot: true, created_at: true },
    orderBy: { created_at: 'asc' },
  });

  const signatories: { userId: string; fullName: string; signedAt: string }[] = [];
  for (const b of ballots) {
    try {
      const { voter } = decryptBallot(privateKeyPem, b.encrypted_ballot);
      if (voter) {
        signatories.push({
          userId: voter.userId,
          fullName: voter.fullName,
          signedAt: b.created_at.toISOString(),
        });
      }
    } catch {
      // Silently skip malformed ballots — should never happen for petitions.
    }
  }

  return NextResponse.json({ signatories, total: signatories.length });
}
