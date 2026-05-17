import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { REGISTRATION_REJECTION_REASON_MAX_LENGTH } from '@/lib/constants';
import { encryptField } from '@/lib/encryption';
import { Errors } from '@/lib/errors';
import { GroupForbiddenError, GroupNotFoundError, requireVKSUGroupMember } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { shapeRegistration } from '@/lib/registrations';
import { isValidUuid } from '@/lib/utils/common';

/**
 * @swagger
 * /api/registrations/{id}/reject:
 *   post:
 *     summary: Reject a candidate registration with a mandatory reason
 *     description: >
 *       Transitions the registration from PENDING_REVIEW to REJECTED. A
 *       non-empty rejection reason is mandatory and is shown to the candidate.
 *       Records the reviewer's identity and the review timestamp. Caller must
 *       be an active member of the form's owning ВКСУ group.
 *     tags:
 *       - CandidateRegistrations
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Registration UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 1
 *                 description: Human-readable reason for the rejection shown to the candidate.
 *     responses:
 *       200:
 *         description: Registration rejected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CandidateRegistration'
 *       400:
 *         description: Invalid UUID, missing or empty reason, or reason exceeds maximum length
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Caller is not an active member of the owning ВКСУ group
 *       404:
 *         description: Registration not found or its form is soft-deleted
 *       409:
 *         description: Registration is not in PENDING_REVIEW state
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid registration id');

  let body: { reason?: string };
  try {
    body = (await req.json()) as { reason?: string };
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const reason = (body.reason ?? '').trim();
  if (!reason) return Errors.badRequest('Причина відхилення обовʼязкова');
  if (reason.length > REGISTRATION_REJECTION_REASON_MAX_LENGTH) {
    return Errors.badRequest(
      `Причина не довша за ${REGISTRATION_REJECTION_REASON_MAX_LENGTH} символів`,
    );
  }

  const reg = await prisma.candidateRegistration.findUnique({
    where: { id },
    include: { form: { select: { group_id: true, deleted_at: true } } },
  });
  if (!reg || reg.form.deleted_at) return Errors.notFound('Registration not found');

  try {
    await requireVKSUGroupMember(reg.form.group_id, auth.user.sub);
  } catch (err) {
    if (err instanceof GroupNotFoundError) return Errors.notFound(err.message);
    if (err instanceof GroupForbiddenError) return Errors.forbidden(err.message);
    throw err;
  }

  if (reg.status !== 'PENDING_REVIEW') {
    return Errors.conflict('Відхилити можна тільки заявку на розгляді');
  }

  const updated = await prisma.candidateRegistration.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewed_by_user_id: auth.user.sub,
      reviewed_by_full_name: encryptField(auth.user.fullName),
      reviewed_at: new Date(),
      rejection_reason: reason,
    },
  });

  return NextResponse.json(shapeRegistration(updated));
}
