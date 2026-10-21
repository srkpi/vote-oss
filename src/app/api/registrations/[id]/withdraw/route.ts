import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { shapeRegistration } from '@/lib/registrations';
import { isValidUuid } from '@/lib/utils/common';

const NON_FINAL_STATUSES = new Set(['DRAFT', 'AWAITING_TEAM', 'PENDING_REVIEW']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return Errors.unauthorized(auth.error);
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return Errors.badRequest('Invalid registration id');
  }

  const reg = await prisma.candidateRegistration.findUnique({
    where: { id },
    include: { form: { select: { deleted_at: true } } },
  });
  if (!reg || reg.form.deleted_at) {
    return Errors.notFound('Registration not found');
  }
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
