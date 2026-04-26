import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { safeDecrypt } from '@/lib/elections-view';
import { encryptField } from '@/lib/encryption';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import {
  validateCampaignProgramUrl,
  validatePhoneNumber,
  validateTelegramTag,
} from '@/lib/registration-validators';
import { shapeRegistration } from '@/lib/registrations';
import { checkRestrictions } from '@/lib/restrictions';
import { isValidUuid } from '@/lib/utils/common';

/**
 * @swagger
 * /api/registrations/{id}/submit:
 *   post:
 *     summary: Submit a draft registration for review
 *     description: >
 *       Validates that all required fields are present and well-formed, then
 *       transitions DRAFT → AWAITING_TEAM (when the form requires team
 *       members) or DRAFT → PENDING_REVIEW (solo).  Submission is gated by
 *       the form's open window and the caller's eligibility.
 *
 *       Note for stage 3: AWAITING_TEAM is a terminal state until stage 4
 *       wires up team-invite tokens.  Forms with team_size > 0 still accept
 *       submission but the candidate cannot progress further yet.
 *     tags: [CandidateRegistrations]
 *     security:
 *       - cookieAuth: []
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid registration id');

  const reg = await prisma.candidateRegistration.findUnique({
    where: { id },
    include: {
      form: {
        include: {
          restrictions: { select: { type: true, value: true } },
          group: { select: { type: true, deleted_at: true } },
        },
      },
    },
  });

  if (!reg) return Errors.notFound('Registration not found');
  if (reg.user_id !== auth.user.sub) {
    return Errors.forbidden('Тільки автор може подати свою заявку');
  }
  if (reg.status !== 'DRAFT') {
    return Errors.conflict('Заявку можна подати лише з чернетки');
  }

  const form = reg.form;
  if (form.deleted_at || form.group.deleted_at !== null || form.group.type !== 'VKSU') {
    return Errors.notFound('Form not found');
  }

  const now = new Date();
  if (now < form.opens_at) return Errors.badRequest('Реєстрація ще не відкрита');
  if (now > form.closes_at) return Errors.badRequest('Прийом заявок закрито');

  const eligible = checkRestrictions(
    form.restrictions.map((r) => ({ type: r.type, value: r.value })),
    {
      faculty: auth.user.faculty,
      group: auth.user.group,
      speciality: auth.user.speciality,
      studyYear: auth.user.studyYear,
      studyForm: auth.user.studyForm,
    },
  );
  if (!eligible) return Errors.forbidden('Ви не відповідаєте обмеженням цієї форми');

  // Hard-validate every required field at submit time.
  const phone = validatePhoneNumber(safeDecrypt(reg.phone_number));
  if (!phone.ok) return Errors.badRequest(phone.error);
  const tag = validateTelegramTag(safeDecrypt(reg.telegram_tag));
  if (!tag.ok) return Errors.badRequest(tag.error);

  if (form.requires_campaign_program) {
    if (!reg.campaign_program_url) {
      return Errors.badRequest('Для цієї форми обовʼязкове посилання на передвиборчу програму');
    }
    const res = validateCampaignProgramUrl(safeDecrypt(reg.campaign_program_url));
    if (!res.ok) return Errors.badRequest(res.error);
  }

  const nextStatus = form.team_size > 0 ? 'AWAITING_TEAM' : 'PENDING_REVIEW';

  const updated = await prisma.candidateRegistration.update({
    where: { id },
    data: {
      status: nextStatus,
      phone_number: encryptField(phone.value),
      telegram_tag: encryptField(tag.value),
      submitted_at: new Date(),
    },
  });

  return NextResponse.json(shapeRegistration(updated));
}
