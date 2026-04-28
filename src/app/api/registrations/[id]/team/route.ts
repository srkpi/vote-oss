import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { GroupForbiddenError, GroupNotFoundError, requireVKSUGroupMember } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { buildSlots } from '@/lib/team-invites';
import { isValidUuid } from '@/lib/utils/common';

/**
 * @swagger
 * /api/registrations/{id}/team:
 *   get:
 *     summary: List team-invite slot statuses for the candidate's registration
 *     description: >
 *       Returns one entry per slot (1..team_size).  Each slot is `empty` /
 *       `pending` / `rejected` / `expired` / `accepted` based on the most
 *       recent token.  Plaintext tokens are never returned here — they are
 *       only revealed to the candidate at creation time via `POST .../[slot]`.
 *     tags: [TeamInvites]
 *     security:
 *       - cookieAuth: []
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid registration id');

  const reg = await prisma.candidateRegistration.findUnique({
    where: { id },
    include: {
      form: { select: { team_size: true, group_id: true } },
      team_invite_tokens: true,
    },
  });
  if (!reg) return Errors.notFound('Registration not found');

  if (reg.user_id !== auth.user.sub) {
    try {
      await requireVKSUGroupMember(reg.form.group_id, auth.user.sub);
    } catch (err) {
      if (err instanceof GroupNotFoundError) return Errors.notFound(err.message);
      if (err instanceof GroupForbiddenError) {
        return Errors.forbidden('Доступно лише автору заявки або члену ВКСУ');
      }
      throw err;
    }
  }

  const slots = buildSlots(reg.form.team_size, reg.team_invite_tokens);
  return NextResponse.json({ teamSize: reg.form.team_size, slots });
}
