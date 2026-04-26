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
 *     summary: List candidate registration forms the caller may apply to
 *     description: >
 *       Returns every non-deleted form whose owning group is a non-deleted
 *       VKSU group, alongside the caller's eligibility flag (true when they
 *       satisfy every restriction).  The candidate-facing /registration page
 *       uses this to list opportunities; ineligible forms are returned too
 *       so the UI can explain why they're inaccessible.
 *     tags: [CandidateRegistrations]
 *     security:
 *       - cookieAuth: []
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
