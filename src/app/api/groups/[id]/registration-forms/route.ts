import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
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
 *       Returns every non-deleted form belonging to the group.  Caller must be
 *       an active member of the group and the group must be of type=VKSU.
 *     tags: [CandidateRegistrationForms]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of forms
 *       403:
 *         description: Group is not VKSU or caller is not a member
 *       404:
 *         description: Group not found
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
 *     summary: Create a candidate registration form
 *     description: >
 *       Creates a new registration form within a ВКСУ group.  Caller must be
 *       an active member.  Validation rules depend on `positionType`:
 *
 *       - `requiresSubdivision` positions must include ≥1 FACULTY restriction.
 *       - `PRESIDENT` may not include any restrictions (university-wide).
 *     tags: [CandidateRegistrationForms]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
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
      created_by_full_name: auth.user.fullName,
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
