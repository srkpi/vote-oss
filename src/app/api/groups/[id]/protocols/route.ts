import { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { PROTOCOL_REQUIRED_ELECTION_CHOICES } from '@/lib/constants';
import { Errors } from '@/lib/errors';
import { GroupForbiddenError, GroupNotFoundError, requireGroupOwner } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import {
  buildOssSnapshot,
  nextProtocolNumber,
  PROTOCOL_INCLUDE,
  shapeProtocol,
  shapeProtocolSummary,
  validateProtocolBody,
} from '@/lib/protocols';
import { isValidUuid } from '@/lib/utils/common';

async function requireProtocolViewer(groupId: string): Promise<void> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { deleted_at: true },
  });
  if (!group || group.deleted_at) throw new GroupNotFoundError();
}

/**
 * @swagger
 * /api/groups/{id}/protocols:
 *   get:
 *     summary: List protocols for a group
 *     tags: [Protocols]
 *     security:
 *       - cookieAuth: []
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid group id');

  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get('nextNumberForYear');

  try {
    await requireProtocolViewer(id);
  } catch (err) {
    if (err instanceof GroupNotFoundError) return Errors.notFound(err.message);
    if (err instanceof GroupForbiddenError) return Errors.forbidden(err.message);
    throw err;
  }

  const rows = await prisma.protocol.findMany({
    where: { group_id: id, deleted_at: null },
    select: {
      id: true,
      group_id: true,
      number: true,
      name: true,
      date: true,
      created_at: true,
      updated_at: true,
      _count: { select: { agenda_items: true } },
    },
    orderBy: [{ date: 'desc' }, { number: 'desc' }],
  });

  if (yearParam) {
    const year = parseInt(yearParam, 10);
    if (!Number.isFinite(year) || year < 1900 || year > 9999) {
      return Errors.badRequest('nextNumberForYear must be a 4-digit year');
    }
    const nextNumber = await nextProtocolNumber(id, year);
    return NextResponse.json({
      protocols: rows.map((r) => shapeProtocolSummary(r)),
      nextNumber,
      year,
    });
  }

  return NextResponse.json(rows.map((r) => shapeProtocolSummary(r)));
}

/**
 * @swagger
 * /api/groups/{id}/protocols:
 *   post:
 *     summary: Create a protocol
 *     tags: [Protocols]
 *     security:
 *       - cookieAuth: []
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid group id');

  try {
    await requireGroupOwner(id, auth.user.sub);
  } catch (err) {
    if (err instanceof GroupNotFoundError) return Errors.notFound(err.message);
    if (err instanceof GroupForbiddenError) {
      return Errors.forbidden('Only the group owner can create protocols');
    }
    throw err;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const validation = validateProtocolBody(body);
  if (!validation.ok) return Errors.badRequest(validation.error);
  const {
    number,
    name,
    date,
    visitors,
    responsibles,
    attendance,
    agendaItems,
    ossSnapshotOverride,
  } = validation.data;

  // Verify any linked elections belong to this group, are closed, and have
  // exactly the required number of choices.
  const linkedElectionIds = Array.from(
    new Set(agendaItems.map((a) => a.electionId).filter((x): x is string => !!x)),
  );
  if (linkedElectionIds.length > 0) {
    const elections = await prisma.election.findMany({
      where: {
        id: { in: linkedElectionIds },
        deleted_at: null,
        restrictions: { some: { type: 'GROUP_MEMBERSHIP', value: id } },
      },
      select: {
        id: true,
        closes_at: true,
        choices: { select: { id: true } },
      },
    });
    const byId = new Map(elections.map((e) => [e.id, e]));
    const now = Date.now();
    for (const eid of linkedElectionIds) {
      const e = byId.get(eid);
      if (!e) {
        return Errors.badRequest(`Election ${eid} is not in this group`);
      }
      if (e.closes_at.getTime() > now) {
        return Errors.badRequest(`Election ${eid} is not yet closed`);
      }
      if (e.choices.length !== PROTOCOL_REQUIRED_ELECTION_CHOICES) {
        return Errors.badRequest(
          `Election ${eid} must have exactly ${PROTOCOL_REQUIRED_ELECTION_CHOICES} choices`,
        );
      }
      // Ensure every choice id in the mapping belongs to this election
      const validChoiceIds = new Set(e.choices.map((c) => c.id));
      const item = agendaItems.find((a) => a.electionId === eid);
      if (item?.choiceMapping) {
        for (const cid of Object.keys(item.choiceMapping)) {
          if (!validChoiceIds.has(cid)) {
            return Errors.badRequest(`Choice ${cid} does not belong to election ${eid}`);
          }
        }
        if (Object.keys(item.choiceMapping).length !== validChoiceIds.size) {
          return Errors.badRequest(
            `Election ${eid} requires every choice to be mapped to yes/no/abstain`,
          );
        }
      }
    }
  }

  const ossSnapshot = await buildOssSnapshot(id, ossSnapshotOverride);

  const created = await prisma.protocol.create({
    data: {
      group_id: id,
      number,
      name,
      date,
      visitors,
      responsibles: responsibles as unknown as Prisma.InputJsonValue,
      attendance: attendance as unknown as Prisma.InputJsonValue,
      oss_snapshot: ossSnapshot as unknown as Prisma.InputJsonValue,
      created_by: auth.user.sub,
      agenda_items: {
        create: agendaItems.map((a, idx) => ({
          position: idx,
          name: a.name,
          listeners: a.listeners as unknown as Prisma.InputJsonValue,
          result: a.result,
          election_id: a.electionId,
          choice_mapping: a.choiceMapping
            ? (a.choiceMapping as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        })),
      },
    },
    include: PROTOCOL_INCLUDE,
  });

  return NextResponse.json(shapeProtocol(created), { status: 201 });
}
