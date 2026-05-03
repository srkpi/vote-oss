import { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { PROTOCOL_REQUIRED_ELECTION_CHOICES } from '@/lib/constants';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import {
  buildOssSnapshot,
  buildVoteTotals,
  computeProtocolCounts,
  PROTOCOL_INCLUDE,
  shapeProtocol,
  validateProtocolBody,
} from '@/lib/protocols';
import { isValidUuid } from '@/lib/utils/common';
import type { VerifiedPayload } from '@/types/auth';

interface ProtocolAccess {
  groupId: string;
  isOwner: boolean;
}

async function loadProtocolAccess(
  protocolId: string,
  user: VerifiedPayload,
  options: { requireOwner: boolean },
): Promise<
  | { ok: true; access: ProtocolAccess }
  | { ok: false; status: 'not_found' | 'forbidden'; message: string }
> {
  const protocol = await prisma.protocol.findUnique({
    where: { id: protocolId },
    select: {
      group_id: true,
      deleted_at: true,
      group: { select: { owner_id: true, deleted_at: true } },
    },
  });
  if (!protocol || protocol.deleted_at || protocol.group.deleted_at) {
    return { ok: false, status: 'not_found', message: 'Protocol not found' };
  }
  const isOwner = protocol.group.owner_id === user.sub;
  if (options.requireOwner && !isOwner) {
    return {
      ok: false,
      status: 'forbidden',
      message: 'Only the group owner can edit this protocol',
    };
  }
  return { ok: true, access: { groupId: protocol.group_id, isOwner } };
}

/**
 * @swagger
 * /api/protocols/{id}:
 *   get:
 *     summary: Get protocol details (with computed counts)
 *     tags: [Protocols]
 *     security:
 *       - cookieAuth: []
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid protocol id');

  const result = await loadProtocolAccess(id, auth.user, { requireOwner: false });
  if (!result.ok) {
    return result.status === 'not_found'
      ? Errors.notFound(result.message)
      : Errors.forbidden(result.message);
  }

  const row = await prisma.protocol.findUnique({
    where: { id },
    include: PROTOCOL_INCLUDE,
  });
  if (!row) return Errors.notFound('Protocol not found');

  const protocol = shapeProtocol(row);
  const linkedElectionIds = protocol.agendaItems
    .map((a) => a.electionId)
    .filter((x): x is string => !!x);
  const counts = await computeProtocolCounts(protocol.groupId, linkedElectionIds);

  // Compute per-item vote totals server-side so the document view can show
  // them even to viewers who don't have access to the linked election.
  const electionRows = linkedElectionIds.length
    ? await prisma.election.findMany({
        where: { id: { in: linkedElectionIds } },
        select: {
          id: true,
          choices: { select: { id: true, vote_count: true } },
        },
      })
    : [];
  const electionsById = new Map(electionRows.map((e) => [e.id, e]));
  const agendaVoteTotals: Record<
    string,
    { yes_count: number; no_count: number; not_decided_count: number } | null
  > = {};
  for (const item of protocol.agendaItems) {
    if (!item.electionId || !item.choiceMapping) {
      agendaVoteTotals[item.id] = null;
      continue;
    }
    const election = electionsById.get(item.electionId);
    if (!election) {
      agendaVoteTotals[item.id] = null;
      continue;
    }
    const choiceCounts = election.choices.map((c) => ({
      id: c.id,
      voteCount: c.vote_count,
    }));
    agendaVoteTotals[item.id] = buildVoteTotals(choiceCounts, item.choiceMapping);
  }

  return NextResponse.json({
    ...protocol,
    counts,
    agendaVoteTotals,
    isOwner: result.access.isOwner,
  });
}

/**
 * @swagger
 * /api/protocols/{id}:
 *   put:
 *     summary: Replace a protocol's contents
 *     tags: [Protocols]
 *     security:
 *       - cookieAuth: []
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid protocol id');

  const result = await loadProtocolAccess(id, auth.user, { requireOwner: true });
  if (!result.ok) {
    return result.status === 'not_found'
      ? Errors.notFound(result.message)
      : Errors.forbidden(result.message);
  }
  const { access } = result;

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

  const linkedElectionIds = Array.from(
    new Set(agendaItems.map((a) => a.electionId).filter((x): x is string => !!x)),
  );
  if (linkedElectionIds.length > 0) {
    const elections = await prisma.election.findMany({
      where: {
        id: { in: linkedElectionIds },
        deleted_at: null,
        restrictions: { some: { type: 'GROUP_MEMBERSHIP', value: access.groupId } },
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
      if (!e) return Errors.badRequest(`Election ${eid} is not in this group`);
      if (e.closes_at.getTime() > now) {
        return Errors.badRequest(`Election ${eid} is not yet closed`);
      }
      if (e.choices.length !== PROTOCOL_REQUIRED_ELECTION_CHOICES) {
        return Errors.badRequest(
          `Election ${eid} must have exactly ${PROTOCOL_REQUIRED_ELECTION_CHOICES} choices`,
        );
      }
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

  const ossSnapshot = await buildOssSnapshot(access.groupId, ossSnapshotOverride);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.protocolAgendaItem.deleteMany({ where: { protocol_id: id } });
    return tx.protocol.update({
      where: { id },
      data: {
        number,
        name,
        date,
        visitors,
        responsibles: responsibles as unknown as Prisma.InputJsonValue,
        attendance: attendance as unknown as Prisma.InputJsonValue,
        oss_snapshot: ossSnapshot as unknown as Prisma.InputJsonValue,
        updated_by: auth.user.sub,
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
  });

  const protocol = shapeProtocol(updated);
  const linkedIds = protocol.agendaItems.map((a) => a.electionId).filter((x): x is string => !!x);
  const counts = await computeProtocolCounts(protocol.groupId, linkedIds);

  return NextResponse.json({ ...protocol, counts, isOwner: access.isOwner });
}

/**
 * @swagger
 * /api/protocols/{id}:
 *   delete:
 *     summary: Soft-delete a protocol
 *     tags: [Protocols]
 *     security:
 *       - cookieAuth: []
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid protocol id');

  const result = await loadProtocolAccess(id, auth.user, { requireOwner: true });
  if (!result.ok) {
    return result.status === 'not_found'
      ? Errors.notFound(result.message)
      : Errors.forbidden(result.message);
  }

  await prisma.protocol.update({
    where: { id },
    data: { deleted_at: new Date(), deleted_by: auth.user.sub },
  });

  return new NextResponse(null, { status: 204 });
}
