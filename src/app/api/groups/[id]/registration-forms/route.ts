import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { encryptField } from '@/lib/encryption';
import { Errors } from '@/lib/errors';
import { GroupForbiddenError, GroupNotFoundError, requireVKSUGroupMember } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { FORM_INCLUDE, shapeForm, validateFormBody } from '@/lib/registration-forms';
import { isValidUuid } from '@/lib/utils/common';

/**
 * @swagger
 * /api/groups/{id}/registration-forms:
 *   get:
 *     summary: List candidate registration forms for a ВКСУ group
 *     description: >
 *       Returns every non-deleted form belonging to the group along with
 *       aggregated submission counts (`submittedCount` = all non-draft
 *       registrations; `pendingReviewCount` = registrations in PENDING_REVIEW
 *       state). Caller must be an active member of the group and the group
 *       must be of type VKSU.
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
 *         description: Group UUID
 *     responses:
 *       200:
 *         description: Array of registration forms with submission counts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/CandidateRegistrationForm'
 *                   - type: object
 *                     required:
 *                       - submittedCount
 *                       - pendingReviewCount
 *                     properties:
 *                       submittedCount:
 *                         type: integer
 *                         minimum: 0
 *                         description: Total registrations excluding drafts.
 *                       pendingReviewCount:
 *                         type: integer
 *                         minimum: 0
 *                         description: Registrations currently awaiting review.
 *       400:
 *         description: Invalid group UUID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Caller is not an active member of the ВКСУ group
 *       404:
 *         description: Group not found, soft-deleted, or not of type VKSU
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid group id');

  try {
    await requireVKSUGroupMember(id, auth.user.sub);
  } catch (err) {
    if (err instanceof GroupNotFoundError) return Errors.notFound(err.message);
    if (err instanceof GroupForbiddenError) return Errors.forbidden(err.message);
    throw err;
  }

  const forms = await prisma.candidateRegistrationForm.findMany({
    where: { group_id: id, deleted_at: null },
    include: FORM_INCLUDE,
    orderBy: { created_at: 'desc' },
  });

  const counts = await prisma.candidateRegistration.groupBy({
    by: ['form_id', 'status'],
    where: { form_id: { in: forms.map((f) => f.id) }, status: { not: 'DRAFT' } },
    _count: { _all: true },
  });

  const countsByForm = new Map<string, { submitted: number; pending: number }>();
  for (const row of counts) {
    const entry = countsByForm.get(row.form_id) ?? { submitted: 0, pending: 0 };
    entry.submitted += row._count._all;
    if (row.status === 'PENDING_REVIEW') entry.pending += row._count._all;
    countsByForm.set(row.form_id, entry);
  }

  return NextResponse.json(
    forms.map((f) => {
      const c = countsByForm.get(f.id) ?? { submitted: 0, pending: 0 };
      return {
        ...shapeForm(f),
        submittedCount: c.submitted,
        pendingReviewCount: c.pending,
      };
    }),
  );
}

/**
 * @swagger
 * /api/groups/{id}/registration-forms:
 *   post:
 *     summary: Create a candidate registration form for a ВКСУ group
 *     description: >
 *       Creates a new candidate registration form within the specified ВКСУ
 *       group. Caller must be an active member of the group. The form's
 *       restrictions determine which students may submit registrations.
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
 *         description: Group UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCandidateRegistrationFormBody'
 *     responses:
 *       201:
 *         description: Form created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/CandidateRegistrationForm'
 *                 - type: object
 *                   required:
 *                     - submittedCount
 *                     - pendingReviewCount
 *                   properties:
 *                     submittedCount:
 *                       type: integer
 *                       example: 0
 *                     pendingReviewCount:
 *                       type: integer
 *                       example: 0
 *       400:
 *         description: Invalid UUID or body validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Caller is not an active ВКСУ group member
 *       404:
 *         description: Group not found, soft-deleted, or not of type VKSU
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid group id');

  try {
    await requireVKSUGroupMember(id, auth.user.sub);
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

  const created = await prisma.candidateRegistrationForm.create({
    data: {
      group_id: id,
      title,
      description,
      requires_campaign_program: requiresCampaignProgram,
      team_size: teamSize,
      opens_at: opensAt,
      closes_at: closesAt,
      created_by: auth.user.sub,
      created_by_full_name: encryptField(auth.user.fullName),
      restrictions: restrictions.length
        ? { create: restrictions.map((r) => ({ type: r.type, value: r.value })) }
        : undefined,
    },
    include: FORM_INCLUDE,
  });

  return NextResponse.json(
    { ...shapeForm(created), submittedCount: 0, pendingReviewCount: 0 },
    { status: 201 },
  );
}
