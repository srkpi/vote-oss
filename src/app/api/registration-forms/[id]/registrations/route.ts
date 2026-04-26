import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { GroupForbiddenError, GroupNotFoundError, requireVKSUGroupMember } from '@/lib/groups';
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
 * /api/registration-forms/{id}/registrations:
 *   get:
 *     summary: List registrations submitted to a form (reviewer-only)
 *     description: >
 *       Caller must be an active member of the form's owning group (currently
 *       always a ВКСУ group).  Returns every non-draft registration.
 *     tags: [CandidateRegistrations]
 *     security:
 *       - cookieAuth: []
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: formId } = await params;
  if (!isValidUuid(formId)) return Errors.badRequest('Invalid form id');

  const form = await prisma.candidateRegistrationForm.findUnique({
    where: { id: formId },
    select: { id: true, group_id: true, deleted_at: true },
  });
  if (!form || form.deleted_at) return Errors.notFound('Form not found');

  try {
    await requireVKSUGroupMember(form.group_id, auth.user.sub);
  } catch (err) {
    if (err instanceof GroupNotFoundError) return Errors.notFound(err.message);
    if (err instanceof GroupForbiddenError) return Errors.forbidden(err.message);
    throw err;
  }

  const registrations = await prisma.candidateRegistration.findMany({
    where: { form_id: formId, status: { not: 'DRAFT' } },
    orderBy: [{ submitted_at: 'desc' }, { created_at: 'desc' }],
  });

  return NextResponse.json(registrations.map(shapeRegistration));
}

/**
 * @swagger
 * /api/registration-forms/{id}/registrations:
 *   post:
 *     summary: Create or update the caller's draft registration for a form
 *     description: >
 *       Idempotent for drafts: if the caller already has a DRAFT for this
 *       form, it is updated.  If a non-DRAFT registration exists, the request
 *       is rejected (409).  Submitting (transitioning out of DRAFT) happens
 *       through `/api/registrations/{id}/submit`.
 *     tags: [CandidateRegistrations]
 *     security:
 *       - cookieAuth: []
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: formId } = await params;
  if (!isValidUuid(formId)) return Errors.badRequest('Invalid form id');

  const form = await prisma.candidateRegistrationForm.findUnique({
    where: { id: formId },
    include: {
      restrictions: { select: { type: true, value: true } },
      group: { select: { type: true, deleted_at: true } },
    },
  });
  if (!form || form.deleted_at) return Errors.notFound('Form not found');
  if (form.group.deleted_at !== null || form.group.type !== 'VKSU') {
    return Errors.notFound('Form not found');
  }

  // Time window
  const now = new Date();
  if (now < form.opens_at) return Errors.badRequest('Реєстрація ще не відкрита');
  if (now > form.closes_at) return Errors.badRequest('Прийом заявок закрито');

  // Eligibility
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

  let body: {
    phoneNumber?: string;
    telegramTag?: string;
    campaignProgramUrl?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const phoneRaw = body.phoneNumber ?? '';
  const tagRaw = body.telegramTag ?? '';
  const programRaw = body.campaignProgramUrl ?? null;

  // Drafts allow blank values; we still validate non-empty ones so candidates
  // see errors as they type.
  const phone = phoneRaw ? validatePhoneNumber(phoneRaw) : { ok: true as const, value: '' };
  if (!phone.ok) return Errors.badRequest(phone.error);

  const tag = tagRaw ? validateTelegramTag(tagRaw) : { ok: true as const, value: '' };
  if (!tag.ok) return Errors.badRequest(tag.error);

  let programUrl: string | null = null;
  if (programRaw !== null && programRaw !== '') {
    const res = validateCampaignProgramUrl(programRaw);
    if (!res.ok) return Errors.badRequest(res.error);
    programUrl = res.value;
  }

  const existing = await prisma.candidateRegistration.findUnique({
    where: { form_id_user_id: { form_id: formId, user_id: auth.user.sub } },
  });

  if (existing && existing.status !== 'DRAFT') {
    return Errors.conflict('Заявка вже подана і не може бути змінена');
  }

  const data = {
    phone_number: phone.value,
    telegram_tag: tag.value,
    campaign_program_url: programUrl,
    full_name: auth.user.fullName,
  };

  const saved = existing
    ? await prisma.candidateRegistration.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.candidateRegistration.create({
        data: {
          form_id: formId,
          user_id: auth.user.sub,
          ...data,
        },
      });

  return NextResponse.json(shapeRegistration(saved), { status: existing ? 200 : 201 });
}
