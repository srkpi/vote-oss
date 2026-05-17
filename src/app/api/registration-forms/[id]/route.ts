import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { GroupForbiddenError, GroupNotFoundError, requireVKSUGroupMember } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { FORM_INCLUDE, shapeForm, validateFormBody } from '@/lib/registration-forms';
import { shapeRegistration } from '@/lib/registrations';
import { checkRestrictions } from '@/lib/restrictions';
import { isValidUuid } from '@/lib/utils/common';

/**
 * @swagger
 * /api/registration-forms/{id}:
 *   get:
 *     summary: Get registration form details (candidate-facing)
 *     description: >
 *       Returns the full form details, the caller's existing registration on
 *       this form (if any, including draft), and an `eligible` flag derived
 *       from the form's restrictions. Any authenticated user may call this
 *       endpoint; the `eligible` flag tells the UI whether the user satisfies
 *       the restrictions without exposing an error.
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
 *         description: Registration form UUID
 *     responses:
 *       200:
 *         description: Form details with caller eligibility and existing registration
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/CandidateRegistrationForm'
 *                 - type: object
 *                   required:
 *                     - eligible
 *                     - myRegistration
 *                   properties:
 *                     eligible:
 *                       type: boolean
 *                       description: Whether the caller satisfies every restriction on the form.
 *                     myRegistration:
 *                       nullable: true
 *                       allOf:
 *                         - $ref: '#/components/schemas/CandidateRegistration'
 *                       description: The caller's existing registration on this form, or null.
 *       400:
 *         description: Invalid form UUID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Form not found, soft-deleted, or its group is not VKSU or is soft-deleted
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid form id');

  const form = await prisma.candidateRegistrationForm.findUnique({
    where: { id },
    include: FORM_INCLUDE,
  });
  if (!form || form.deleted_at) return Errors.notFound('Form not found');
  if (form.group.deleted_at !== null) return Errors.notFound('Form not found');

  const myRegistration = await prisma.candidateRegistration.findUnique({
    where: { form_id_user_id: { form_id: id, user_id: auth.user.sub } },
  });

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

  return NextResponse.json({
    ...shapeForm(form),
    eligible,
    myRegistration: myRegistration ? shapeRegistration(myRegistration) : null,
  });
}

/**
 * @swagger
 * /api/registration-forms/{id}:
 *   patch:
 *     summary: Update a candidate registration form
 *     description: >
 *       Replaces all mutable fields on the form. Existing restrictions are
 *       hard-deleted and recreated atomically. Caller must be an active ВКСУ
 *       member of the form's group. The same validation rules as form creation
 *       apply.
 *     tags:
 *       - CandidateRegistrationForms
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Registration form UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCandidateRegistrationFormBody'
 *     responses:
 *       200:
 *         description: Form updated; returns the full updated form
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CandidateRegistrationForm'
 *       400:
 *         description: Invalid UUID or body validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Caller is not an active ВКСУ group member
 *       404:
 *         description: Form not found or soft-deleted
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid form id');

  const existing = await prisma.candidateRegistrationForm.findUnique({
    where: { id },
    select: { id: true, group_id: true, deleted_at: true },
  });
  if (!existing || existing.deleted_at) return Errors.notFound('Form not found');

  try {
    await requireVKSUGroupMember(existing.group_id, auth.user.sub);
  } catch (err) {
    if (err instanceof GroupNotFoundError) return Errors.notFound(err.message);
    if (err instanceof GroupForbiddenError) return Errors.forbidden(err.message);
    throw err;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const validation = validateFormBody(body);
  if (!validation.ok) return Errors.badRequest(validation.error);
  const { title, description, requiresCampaignProgram, teamSize, opensAt, closesAt, restrictions } =
    validation.data;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.candidateRegistrationFormRestriction.deleteMany({ where: { form_id: id } });
    return tx.candidateRegistrationForm.update({
      where: { id },
      data: {
        title,
        description,
        requires_campaign_program: requiresCampaignProgram,
        team_size: teamSize,
        opens_at: opensAt,
        closes_at: closesAt,
        updated_by: auth.user.sub,
        restrictions: restrictions.length
          ? { create: restrictions.map((r) => ({ type: r.type, value: r.value })) }
          : undefined,
      },
      include: FORM_INCLUDE,
    });
  });

  return NextResponse.json(shapeForm(updated));
}

/**
 * @swagger
 * /api/registration-forms/{id}:
 *   delete:
 *     summary: Soft-delete a candidate registration form
 *     description: >
 *       Marks the form as deleted. Soft-deleted forms are no longer returned
 *       in any listing endpoint. Caller must be an active ВКСУ member of the
 *       form's group.
 *     tags:
 *       - CandidateRegistrationForms
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Registration form UUID
 *     responses:
 *       204:
 *         description: Form soft-deleted
 *       400:
 *         description: Invalid form UUID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Caller is not an active ВКСУ group member
 *       404:
 *         description: Form not found or already soft-deleted
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid form id');

  const existing = await prisma.candidateRegistrationForm.findUnique({
    where: { id },
    select: { id: true, group_id: true, deleted_at: true },
  });
  if (!existing || existing.deleted_at) return Errors.notFound('Form not found');

  try {
    await requireVKSUGroupMember(existing.group_id, auth.user.sub);
  } catch (err) {
    if (err instanceof GroupNotFoundError) return Errors.notFound(err.message);
    if (err instanceof GroupForbiddenError) return Errors.forbidden(err.message);
    throw err;
  }

  await prisma.candidateRegistrationForm.update({
    where: { id },
    data: { deleted_at: new Date(), deleted_by: auth.user.sub },
  });

  return new NextResponse(null, { status: 204 });
}
