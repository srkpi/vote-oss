import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { FORM_INCLUDE, shapeForm } from '@/lib/registration-forms';
import { checkRestrictions } from '@/lib/restrictions';

/**
 * @swagger
 * /api/registration-forms:
 *   get:
 *     summary: List candidate registration forms the caller may view
 *     description: >
 *       Returns every non-deleted registration form whose owning group is a
 *       non-deleted ВКСУ group. Ordered by closes_at ascending so approaching
 *       deadlines appear first. Each entry includes:
 *
 *       - `eligible`: whether the caller satisfies every restriction on the
 *         form (used by the UI to indicate ineligible forms without hiding them).
 *       - `myRegistrationStatus`: the caller's registration status on this form
 *         (excluding DRAFT which is private), or null if none exists.
 *     tags:
 *       - CandidateRegistrations
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of registration form summaries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/CandidateRegistrationForm'
 *                   - type: object
 *                     required:
 *                       - eligible
 *                       - myRegistrationStatus
 *                     properties:
 *                       eligible:
 *                         type: boolean
 *                       myRegistrationStatus:
 *                         type: string
 *                         enum: [AWAITING_TEAM, PENDING_REVIEW, APPROVED, REJECTED, WITHDRAWN]
 *                         nullable: true
 *                         description: The caller's current non-draft registration status, or null.
 *       401:
 *         description: Unauthorized
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const forms = await prisma.candidateRegistrationForm.findMany({
    where: {
      deleted_at: null,
      group: { type: 'VKSU', deleted_at: null },
    },
    include: FORM_INCLUDE,
    orderBy: { closes_at: 'asc' },
  });

  const myRegistrations = await prisma.candidateRegistration.findMany({
    where: { user_id: auth.user.sub, form_id: { in: forms.map((f) => f.id) } },
    select: { form_id: true, status: true },
  });
  const statusByFormId = new Map(myRegistrations.map((r) => [r.form_id, r.status]));

  const userCtx = {
    faculty: auth.user.faculty,
    group: auth.user.group,
    speciality: auth.user.speciality,
    studyYear: auth.user.studyYear,
    studyForm: auth.user.studyForm,
  };

  return NextResponse.json(
    forms.map((f) => ({
      ...shapeForm(f),
      eligible: checkRestrictions(
        f.restrictions.map((r) => ({ type: r.type, value: r.value })),
        userCtx,
      ),
      myRegistrationStatus: statusByFormId.get(f.id) ?? null,
    })),
  );
}
