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
 *     summary: List team-invite slot statuses for a registration
 *     description: >
 *       Returns one entry per slot (1..team_size) showing the current state
 *       and, where applicable, the invitee's identity. Plaintext tokens are
 *       never returned here; they are only revealed to the candidate at
 *       creation time via POST /api/registrations/{id}/team/{slot}.
 *
 *       Accessible to the registration's author or any active member of the
 *       form's owning ВКСУ group.
 *
 *       Slot states:
 *         - **empty**: no token has ever been issued for this slot.
 *         - **pending**: an invite token is outstanding, awaiting the invitee's response.
 *         - **rejected**: the invitee declined the invite. Candidate can regenerate.
 *         - **expired**: the token expired or was revoked before the invitee responded.
 *         - **awaiting_candidate**: the invitee accepted; the candidate must confirm or decline.
 *         - **declined**: the candidate decided not to keep the accepted invitee. Candidate can regenerate.
 *         - **accepted**: the invitee accepted and the candidate confirmed (terminal; slot is locked).
 *     tags:
 *       - TeamInvites
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Registration UUID
 *     responses:
 *       200:
 *         description: Team slot statuses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - teamSize
 *                 - slots
 *               properties:
 *                 teamSize:
 *                   type: integer
 *                   minimum: 0
 *                 slots:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TeamSlot'
 *       400:
 *         description: Invalid registration UUID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Caller is neither the registration author nor an active ВКСУ group member
 *       404:
 *         description: Registration not found
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
