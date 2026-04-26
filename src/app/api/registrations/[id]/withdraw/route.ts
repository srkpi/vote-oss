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
 *     summary: Withdraw a registration
 *     description: >
 *       Authored candidate withdraws their registration.  Allowed from any
 *       non-final state (DRAFT, AWAITING_TEAM, PENDING_REVIEW).  Final states
 *       (APPROVED, REJECTED, WITHDRAWN) cannot be reverted.
 *     tags: [CandidateRegistrations]
 *     security:
 *       - cookieAuth: []
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid registration id');

  const reg = await prisma.candidateRegistration.findUnique({ where: { id } });
  if (!reg) return Errors.notFound('Registration not found');
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
