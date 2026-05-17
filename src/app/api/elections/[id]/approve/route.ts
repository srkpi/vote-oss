import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { invalidateElections } from '@/lib/cache';
import { decryptField, encryptField } from '@/lib/encryption';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';
import { computePetitionClosesAt } from '@/lib/utils/petition-date';

/**
 * @swagger
 * /api/elections/{id}/approve:
 *   post:
 *     summary: Approve a pending petition
 *     description: >
 *       Approves an unapproved petition, making it immediately open for
 *       signatures. Only admins with `manage_petitions` may call this endpoint.
 *       Regular elections cannot be approved via this endpoint — they are
 *       auto-approved on creation.
 *
 *       On approval:
 *         - `approved` is set to true.
 *         - `approved_by_id` and `approved_by_full_name` are recorded.
 *         - `opens_at` is reset to the current timestamp.
 *         - `closes_at` is set to `opens_at` + 1 calendar month (via
 *           `computePetitionClosesAt`).
 *
 *       The elections metadata cache is invalidated after the update.
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
 *         description: Petition approved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApprovedPetitionResponse'
 *       400:
 *         description: Invalid UUID, the resource is not a petition, or the petition is already approved
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – caller is not an admin with manage_petitions
 *       404:
 *         description: Petition not found or soft-deleted
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }
  const { admin } = auth;

  if (!admin.manage_petitions) {
    return Errors.forbidden('Only petition managers can approve petitions');
  }

  const { id: electionId } = await params;
  if (!isValidUuid(electionId)) return Errors.badRequest('Invalid election id');

  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election || election.deleted_at) return Errors.notFound('Petition not found');
  if (election.type !== 'PETITION') {
    return Errors.badRequest('Only petitions can be approved');
  }
  if (election.approved) {
    return Errors.badRequest('Petition is already approved');
  }

  const now = new Date();
  const closesAt = computePetitionClosesAt(now);

  await prisma.election.update({
    where: { id: electionId },
    data: {
      approved: true,
      approved_by_id: admin.user_id,
      approved_by_full_name: encryptField(admin.full_name),
      approved_at: now,
      opens_at: now,
      closes_at: closesAt,
    },
  });

  await invalidateElections();

  // Decrypt stored creator name so the response is immediately usable by the
  // admin UI without an extra fetch.
  let createdByFullName = election.created_by_full_name;
  try {
    createdByFullName = decryptField(election.created_by_full_name);
  } catch {
    /* leave as-is */
  }

  return NextResponse.json({
    id: election.id,
    approved: true,
    approvedBy: { userId: admin.user_id, fullName: admin.full_name },
    approvedAt: now.toISOString(),
    opensAt: now.toISOString(),
    closesAt: closesAt.toISOString(),
    createdBy: { userId: election.created_by, fullName: createdByFullName },
  });
}
