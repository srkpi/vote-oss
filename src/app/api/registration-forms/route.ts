import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { FORM_INCLUDE, shapeForm } from '@/lib/registration-forms';
import { checkRestrictions } from '@/lib/restrictions';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const forms = await prisma.candidateRegistrationForm.findMany({
    where: {
      deleted_at: null,
      group: { type: 'VKSU', deleted_at: null },
    },
    include: FORM_INCLUDE,
    orderBy: { created_at: 'desc' },
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
