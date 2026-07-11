import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { shapeRegistration } from '@/lib/registrations';
import { isValidUuid } from '@/lib/utils/common';

const NON_FINAL_STATUSES = new Set(['DRAFT', 'AWAITING_TEAM', 'PENDING_REVIEW']);

/**
 * @swagger
 * /api/registrations/{id}/withdraw:
 *   post:
 *     summary: Withdraw a candidate registration
 *     description: >
 *       Transitions the registration to WITHDRAWN. Only the registration's
 *       author (candidate) may withdraw their registration. Withdrawal is
 *       allowed from any non-final state: DRAFT, AWAITING_TEAM, or
 *       PENDING_REVIEW. Final states (APPROVED, REJECTED, WITHDRAWN) cannot
 *       be reverted.
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
 *     responses:
 *       200:
 *         description: Registration withdrawn
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CandidateRegistration'
 *       400:
 *         description: Invalid registration UUID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Caller is not the registration author
 *       404:
 *         description: Registration not found or its form is soft-deleted
 *       409:
 *         description: Registration is already in a final state (APPROVED, REJECTED, or WITHDRAWN)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid registration id');

  const reg = await prisma.candidateRegistration.findUnique({
    where: { id },
    include: { form: { select: { deleted_at: true } } },
  });
  if (!reg || reg.form.deleted_at) return Errors.notFound('Registration not found');
  if (reg.user_id !== auth.user.sub) {
    return Errors.forbidden('Тільки автор може відкликати свою заявку');
  }
  if (!NON_FINAL_STATUSES.has(reg.status)) {
    return Errors.conflict('Заявку вже неможливо відкликати');
  }

  const updated = await prisma.candidateRegistration.update({
    where: { id },
    data: { status: 'WITHDRAWN', withdrawn_at: new Date() },
  });

  return NextResponse.json(shapeRegistration(updated));
}
