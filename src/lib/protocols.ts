import type { Prisma } from '@prisma/client';

import {
  PROTOCOL_AGENDA_ITEM_NAME_MAX_LENGTH,
  PROTOCOL_AGENDA_ITEM_RESULT_MAX_LENGTH,
  PROTOCOL_ATTENDEE_PRESENT_TEXT_MAX_LENGTH,
  PROTOCOL_LISTENER_FULLNAME_MAX_LENGTH,
  PROTOCOL_LISTENER_SPEECH_MAX_LENGTH,
  PROTOCOL_LOGO_HEIGHT_MM,
  PROTOCOL_MAX_AGENDA_ITEMS,
  PROTOCOL_MAX_ATTENDEES,
  PROTOCOL_MAX_LISTENERS_PER_ITEM,
  PROTOCOL_MAX_RESPONSIBLES,
  PROTOCOL_MAX_VISITORS,
  PROTOCOL_NAME_MAX_LENGTH,
  PROTOCOL_REQUIRED_ELECTION_CHOICES,
  PROTOCOL_RESPONSIBLE_FULLNAME_MAX_LENGTH,
  PROTOCOL_RESPONSIBLE_POSADA_MAX_LENGTH,
} from '@/lib/constants';
import { fileProxyUrl } from '@/lib/files';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';
import type {
  AgendaChoiceVote,
  Protocol,
  ProtocolAgendaItem,
  ProtocolAgendaItemInput,
  ProtocolAttendee,
  ProtocolChoiceMapping,
  ProtocolComputedCounts,
  ProtocolListener,
  ProtocolOssSnapshot,
  ProtocolResponsible,
  ProtocolSummary,
} from '@/types/protocol';

export const PROTOCOL_INCLUDE = {
  agenda_items: {
    orderBy: { position: 'asc' as const },
  },
} as const;

export type ProtocolWithAgenda = Prisma.ProtocolGetPayload<{ include: typeof PROTOCOL_INCLUDE }>;

// ────────────────────────────────────────────────────────────────────────────
// Shape helpers
// ────────────────────────────────────────────────────────────────────────────

function parseListeners(value: Prisma.JsonValue): ProtocolListener[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const obj = item as Record<string, unknown>;
    const fullname = typeof obj.fullname === 'string' ? obj.fullname : '';
    const speech = typeof obj.speech === 'string' ? obj.speech : '';
    return [{ fullname, speech }];
  });
}

function parseResponsibles(value: Prisma.JsonValue): ProtocolResponsible[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const obj = item as Record<string, unknown>;
    const posada = typeof obj.posada === 'string' ? obj.posada : '';
    const fullname = typeof obj.fullname === 'string' ? obj.fullname : '';
    return [{ posada, fullname }];
  });
}

function parseAttendance(value: Prisma.JsonValue): ProtocolAttendee[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const obj = item as Record<string, unknown>;
    const fullname = typeof obj.fullname === 'string' ? obj.fullname : '';
    const posada = typeof obj.posada === 'string' ? obj.posada : '';
    const present_text = typeof obj.present_text === 'string' ? obj.present_text : '';
    const userId = typeof obj.userId === 'string' ? obj.userId : null;
    return [{ userId, fullname, posada, present_text }];
  });
}

function parseChoiceMapping(value: Prisma.JsonValue | null): ProtocolChoiceMapping | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result: ProtocolChoiceMapping = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw === 'yes' || raw === 'no' || raw === 'abstain') {
      result[key] = raw;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

function parseOssSnapshot(value: Prisma.JsonValue): ProtocolOssSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { name: '', address: '', email: '', contact: '' };
  }
  const obj = value as Record<string, unknown>;
  return {
    name: typeof obj.name === 'string' ? obj.name : '',
    address: typeof obj.address === 'string' ? obj.address : '',
    email: typeof obj.email === 'string' ? obj.email : '',
    contact: typeof obj.contact === 'string' ? obj.contact : '',
  };
}

export function shapeProtocol(row: ProtocolWithAgenda): Protocol {
  return {
    id: row.id,
    groupId: row.group_id,
    number: row.number,
    name: row.name,
    date: row.date.toISOString(),
    visitors: row.visitors,
    responsibles: parseResponsibles(row.responsibles),
    attendance: parseAttendance(row.attendance),
    ossSnapshot: parseOssSnapshot(row.oss_snapshot),
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    deletedAt: row.deleted_at?.toISOString() ?? null,
    agendaItems: row.agenda_items.map<ProtocolAgendaItem>((a) => ({
      id: a.id,
      position: a.position,
      name: a.name,
      listeners: parseListeners(a.listeners),
      result: a.result,
      electionId: a.election_id,
      choiceMapping: parseChoiceMapping(a.choice_mapping),
    })),
  };
}

export function shapeProtocolSummary(
  row: Pick<
    ProtocolWithAgenda,
    'id' | 'group_id' | 'number' | 'name' | 'date' | 'created_at' | 'updated_at'
  > & { _count: { agenda_items: number } },
): ProtocolSummary {
  return {
    id: row.id,
    groupId: row.group_id,
    number: row.number,
    name: row.name,
    date: row.date.toISOString(),
    agendaItemCount: row._count.agenda_items,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Body validation
// ────────────────────────────────────────────────────────────────────────────

export interface ValidatedProtocolBody {
  number: number;
  name: string;
  date: Date;
  visitors: number | null;
  responsibles: ProtocolResponsible[];
  attendance: ProtocolAttendee[];
  agendaItems: ProtocolAgendaItemInput[];
  ossSnapshotOverride: Partial<ProtocolOssSnapshot> | null;
}

type Validation<T> = { ok: true; data: T } | { ok: false; error: string };

function trimRequired(value: unknown, max: number, label: string): Validation<string> {
  if (typeof value !== 'string') return { ok: false, error: `${label} must be a string` };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: false, error: `${label} is required` };
  if (trimmed.length > max)
    return { ok: false, error: `${label} must be at most ${max} characters` };
  return { ok: true, data: trimmed };
}

function trimOptional(value: unknown, max: number, label: string): Validation<string | null> {
  if (value === undefined || value === null) return { ok: true, data: null };
  if (typeof value !== 'string') return { ok: false, error: `${label} must be a string` };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, data: null };
  if (trimmed.length > max)
    return { ok: false, error: `${label} must be at most ${max} characters` };
  return { ok: true, data: trimmed };
}

export function validateProtocolBody(input: unknown): Validation<ValidatedProtocolBody> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Body must be an object' };
  }
  const body = input as Record<string, unknown>;

  const nameRes = trimRequired(body.name, PROTOCOL_NAME_MAX_LENGTH, 'name');
  if (!nameRes.ok) return nameRes;

  if (typeof body.date !== 'string') return { ok: false, error: 'date is required' };
  const parsedDate = new Date(body.date);
  if (Number.isNaN(parsedDate.getTime())) return { ok: false, error: 'date is invalid' };

  if (
    typeof body.number !== 'number' ||
    !Number.isFinite(body.number) ||
    body.number < 1 ||
    Math.floor(body.number) !== body.number
  ) {
    return { ok: false, error: 'number must be a positive integer' };
  }
  const number = body.number;

  let visitors: number | null = null;
  if (body.visitors !== undefined && body.visitors !== null) {
    if (
      typeof body.visitors !== 'number' ||
      !Number.isFinite(body.visitors) ||
      body.visitors < 0 ||
      body.visitors > PROTOCOL_MAX_VISITORS
    ) {
      return { ok: false, error: `visitors must be between 0 and ${PROTOCOL_MAX_VISITORS}` };
    }
    visitors = Math.floor(body.visitors);
  }

  // responsibles
  if (!Array.isArray(body.responsibles) || body.responsibles.length === 0) {
    return { ok: false, error: 'responsibles must be a non-empty array' };
  }
  if (body.responsibles.length > PROTOCOL_MAX_RESPONSIBLES) {
    return { ok: false, error: `at most ${PROTOCOL_MAX_RESPONSIBLES} responsibles allowed` };
  }
  const responsibles: ProtocolResponsible[] = [];
  for (const [i, raw] of body.responsibles.entries()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, error: `responsibles[${i}] must be an object` };
    }
    const r = raw as Record<string, unknown>;
    const posadaRes = trimRequired(
      r.posada,
      PROTOCOL_RESPONSIBLE_POSADA_MAX_LENGTH,
      `responsibles[${i}].posada`,
    );
    if (!posadaRes.ok) return posadaRes;
    const fullnameRes = trimRequired(
      r.fullname,
      PROTOCOL_RESPONSIBLE_FULLNAME_MAX_LENGTH,
      `responsibles[${i}].fullname`,
    );
    if (!fullnameRes.ok) return fullnameRes;
    responsibles.push({ posada: posadaRes.data, fullname: fullnameRes.data });
  }

  // attendance (optional)
  const attendance: ProtocolAttendee[] = [];
  if (body.attendance !== undefined && body.attendance !== null) {
    if (!Array.isArray(body.attendance)) {
      return { ok: false, error: 'attendance must be an array' };
    }
    if (body.attendance.length > PROTOCOL_MAX_ATTENDEES) {
      return { ok: false, error: `at most ${PROTOCOL_MAX_ATTENDEES} attendees allowed` };
    }
    for (const [i, raw] of body.attendance.entries()) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { ok: false, error: `attendance[${i}] must be an object` };
      }
      const a = raw as Record<string, unknown>;
      const fullnameRes = trimRequired(
        a.fullname,
        PROTOCOL_RESPONSIBLE_FULLNAME_MAX_LENGTH,
        `attendance[${i}].fullname`,
      );
      if (!fullnameRes.ok) return fullnameRes;
      const posadaRes = trimRequired(
        a.posada,
        PROTOCOL_RESPONSIBLE_POSADA_MAX_LENGTH,
        `attendance[${i}].posada`,
      );
      if (!posadaRes.ok) return posadaRes;
      const presentRes = trimRequired(
        a.present_text,
        PROTOCOL_ATTENDEE_PRESENT_TEXT_MAX_LENGTH,
        `attendance[${i}].present_text`,
      );
      if (!presentRes.ok) return presentRes;
      let userId: string | null = null;
      if (a.userId !== undefined && a.userId !== null) {
        if (typeof a.userId !== 'string' || a.userId.length === 0) {
          return { ok: false, error: `attendance[${i}].userId must be a non-empty string` };
        }
        userId = a.userId;
      }
      attendance.push({
        userId,
        fullname: fullnameRes.data,
        posada: posadaRes.data,
        present_text: presentRes.data,
      });
    }
  }

  // agenda items
  if (!Array.isArray(body.agendaItems) || body.agendaItems.length === 0) {
    return { ok: false, error: 'agendaItems must be a non-empty array' };
  }
  if (body.agendaItems.length > PROTOCOL_MAX_AGENDA_ITEMS) {
    return { ok: false, error: `at most ${PROTOCOL_MAX_AGENDA_ITEMS} agenda items allowed` };
  }
  const agendaItems: ProtocolAgendaItemInput[] = [];
  for (const [i, raw] of body.agendaItems.entries()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, error: `agendaItems[${i}] must be an object` };
    }
    const a = raw as Record<string, unknown>;
    const aNameRes = trimRequired(
      a.name,
      PROTOCOL_AGENDA_ITEM_NAME_MAX_LENGTH,
      `agendaItems[${i}].name`,
    );
    if (!aNameRes.ok) return aNameRes;
    const resultRes = trimOptional(
      a.result,
      PROTOCOL_AGENDA_ITEM_RESULT_MAX_LENGTH,
      `agendaItems[${i}].result`,
    );
    if (!resultRes.ok) return resultRes;

    if (!Array.isArray(a.listeners) || a.listeners.length === 0) {
      return { ok: false, error: `agendaItems[${i}].listeners must be a non-empty array` };
    }
    if (a.listeners.length > PROTOCOL_MAX_LISTENERS_PER_ITEM) {
      return {
        ok: false,
        error: `agendaItems[${i}] listeners must be at most ${PROTOCOL_MAX_LISTENERS_PER_ITEM}`,
      };
    }
    const listeners: ProtocolListener[] = [];
    for (const [j, lraw] of a.listeners.entries()) {
      if (!lraw || typeof lraw !== 'object' || Array.isArray(lraw)) {
        return { ok: false, error: `agendaItems[${i}].listeners[${j}] must be an object` };
      }
      const l = lraw as Record<string, unknown>;
      const fnRes = trimRequired(
        l.fullname,
        PROTOCOL_LISTENER_FULLNAME_MAX_LENGTH,
        `agendaItems[${i}].listeners[${j}].fullname`,
      );
      if (!fnRes.ok) return fnRes;
      const speechRes = trimRequired(
        l.speech,
        PROTOCOL_LISTENER_SPEECH_MAX_LENGTH,
        `agendaItems[${i}].listeners[${j}].speech`,
      );
      if (!speechRes.ok) return speechRes;
      listeners.push({ fullname: fnRes.data, speech: speechRes.data });
    }

    let electionId: string | null = null;
    if (a.electionId !== undefined && a.electionId !== null) {
      if (typeof a.electionId !== 'string' || !isValidUuid(a.electionId)) {
        return { ok: false, error: `agendaItems[${i}].electionId must be a valid UUID` };
      }
      electionId = a.electionId;
    }

    let choiceMapping: ProtocolChoiceMapping | null = null;
    if (a.choiceMapping !== undefined && a.choiceMapping !== null) {
      if (typeof a.choiceMapping !== 'object' || Array.isArray(a.choiceMapping)) {
        return { ok: false, error: `agendaItems[${i}].choiceMapping must be an object` };
      }
      const m = a.choiceMapping as Record<string, unknown>;
      const out: ProtocolChoiceMapping = {};
      for (const [cid, vote] of Object.entries(m)) {
        if (!isValidUuid(cid)) {
          return { ok: false, error: `agendaItems[${i}].choiceMapping has invalid choice id` };
        }
        if (vote !== 'yes' && vote !== 'no' && vote !== 'abstain') {
          return {
            ok: false,
            error: `agendaItems[${i}].choiceMapping[${cid}] must be yes|no|abstain`,
          };
        }
        out[cid] = vote;
      }
      choiceMapping = out;
    }

    if (electionId && !choiceMapping) {
      return {
        ok: false,
        error: `agendaItems[${i}] linked election requires a choiceMapping`,
      };
    }
    if (!electionId && choiceMapping) {
      return {
        ok: false,
        error: `agendaItems[${i}] choiceMapping requires a linked electionId`,
      };
    }

    agendaItems.push({
      name: aNameRes.data,
      listeners,
      result: resultRes.data,
      electionId,
      choiceMapping,
    });
  }

  // ossSnapshot override (optional)
  let ossSnapshotOverride: Partial<ProtocolOssSnapshot> | null = null;
  if (body.ossSnapshot !== undefined && body.ossSnapshot !== null) {
    if (typeof body.ossSnapshot !== 'object' || Array.isArray(body.ossSnapshot)) {
      return { ok: false, error: 'ossSnapshot must be an object' };
    }
    const s = body.ossSnapshot as Record<string, unknown>;
    ossSnapshotOverride = {};
    for (const key of ['name', 'address', 'email', 'contact'] as const) {
      if (s[key] !== undefined) {
        if (typeof s[key] !== 'string') {
          return { ok: false, error: `ossSnapshot.${key} must be a string` };
        }
        ossSnapshotOverride[key] = (s[key] as string).trim();
      }
    }
  }

  return {
    ok: true,
    data: {
      number,
      name: nameRes.data,
      date: parsedDate,
      visitors,
      responsibles,
      attendance,
      agendaItems,
      ossSnapshotOverride,
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// OSS snapshot construction
// ────────────────────────────────────────────────────────────────────────────

export async function buildOssSnapshot(
  groupId: string,
  override: Partial<ProtocolOssSnapshot> | null,
): Promise<ProtocolOssSnapshot> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      name: true,
      full_name: true,
      address: true,
      email: true,
      contact: true,
    },
  });
  if (!group) throw new Error('Group not found while building OSS snapshot');

  const fromGroup: ProtocolOssSnapshot = {
    name: group.full_name?.trim() || group.name,
    address: group.address ?? '',
    email: group.email ?? '',
    contact: group.contact ?? '',
  };

  if (!override) return fromGroup;
  return {
    name: override.name?.trim() || fromGroup.name,
    address: override.address ?? fromGroup.address,
    email: override.email ?? fromGroup.email,
    contact: override.contact ?? fromGroup.contact,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Computed counts (total / present / quorum)
// ────────────────────────────────────────────────────────────────────────────

export async function computeProtocolCounts(
  groupId: string,
  linkedElectionIds: string[],
): Promise<ProtocolComputedCounts> {
  const memberCount = await prisma.groupMember.count({
    where: { group_id: groupId, deleted_at: null },
  });

  let present = 0;
  if (linkedElectionIds.length > 0) {
    // For anonymous ballots we can't link a ballot back to a user, so we
    // approximate "present" with the maximum number of ballots cast across the
    // linked elections — assumes anyone present voted in at least one item.
    const counts = await prisma.ballot.groupBy({
      by: ['election_id'],
      where: { election_id: { in: linkedElectionIds } },
      _count: { _all: true },
    });
    for (const row of counts) {
      if (row._count._all > present) present = row._count._all;
    }
  }

  const quorum = Math.ceil((memberCount * 2) / 3);
  return { total: memberCount, present, quorum };
}

/**
 * Next protocol number for a given group/year — `MAX(number) + 1` over
 * non-deleted protocols whose `date` falls inside the year, or `1` if none.
 */
export async function nextProtocolNumber(groupId: string, year: number): Promise<number> {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const max = await prisma.protocol.aggregate({
    where: {
      group_id: groupId,
      deleted_at: null,
      date: { gte: yearStart, lt: yearEnd },
    },
    _max: { number: true },
  });
  return (max._max.number ?? 0) + 1;
}

export function isLinkableElection(choiceCount: number): boolean {
  return choiceCount === PROTOCOL_REQUIRED_ELECTION_CHOICES;
}

export function buildVoteTotals(
  choiceCounts: { id: string; voteCount: number | null }[],
  mapping: ProtocolChoiceMapping,
): { yes_count: number; no_count: number; not_decided_count: number } {
  let yes = 0;
  let no = 0;
  let abstain = 0;
  for (const c of choiceCounts) {
    const m = mapping[c.id];
    const count = c.voteCount ?? 0;
    if (m === 'yes') yes += count;
    else if (m === 'no') no += count;
    else if (m === 'abstain') abstain += count;
  }
  return { yes_count: yes, no_count: no, not_decided_count: abstain };
}

export function emptyVoteTotals(): {
  yes_count: number;
  no_count: number;
  not_decided_count: number;
} {
  return { yes_count: 0, no_count: 0, not_decided_count: 0 };
}

// ────────────────────────────────────────────────────────────────────────────
// External generator payload
// ────────────────────────────────────────────────────────────────────────────

interface GeneratorEvent {
  name: string;
  listeners: ProtocolListener[];
  result?: string;
  votes?: { yes_count: number; no_count: number; not_decided_count: number };
}

interface GeneratorImageDim {
  unit: 'mm';
  value: number;
}

interface GeneratorImageVariable {
  _type: 'image';
  _props: {
    url: string;
    height: GeneratorImageDim;
  };
}

export interface GeneratorPayload {
  oss: ProtocolOssSnapshot;
  protocol: { number: number; name: string; date: string };
  voters: ProtocolComputedCounts;
  events: GeneratorEvent[];
  responsibles: ProtocolResponsible[];
  visitors?: number;
  members?: { fullname: string; posada: string; present_text: string }[];
  logo?: GeneratorImageVariable;
}

export async function buildGeneratorPayload(protocolId: string): Promise<GeneratorPayload> {
  const row = await prisma.protocol.findUnique({
    where: { id: protocolId },
    include: {
      agenda_items: {
        orderBy: { position: 'asc' },
        include: {
          election: {
            select: {
              id: true,
              choices: { select: { id: true, vote_count: true } },
            },
          },
        },
      },
      group: {
        select: {
          logo_file: {
            select: { id: true, bucket: true, object_key: true, deleted_at: true },
          },
        },
      },
    },
  });
  if (!row) throw new Error('Protocol not found');

  const protocol = shapeProtocol(row);
  const linkedElectionIds = protocol.agendaItems
    .map((a) => a.electionId)
    .filter((x): x is string => !!x);
  const counts = await computeProtocolCounts(protocol.groupId, linkedElectionIds);

  const events: GeneratorEvent[] = row.agenda_items.map((rawAgenda, idx) => {
    const agenda = protocol.agendaItems[idx];
    const event: GeneratorEvent = {
      name: agenda.name,
      listeners: agenda.listeners,
    };
    if (agenda.result) event.result = agenda.result;
    if (rawAgenda.election && agenda.choiceMapping) {
      const counts = rawAgenda.election.choices.map((c) => ({
        id: c.id,
        voteCount: c.vote_count,
      }));
      event.votes = buildVoteTotals(counts, agenda.choiceMapping);
    }
    return event;
  });

  const payload: GeneratorPayload = {
    oss: protocol.ossSnapshot,
    protocol: {
      number: protocol.number,
      name: protocol.name,
      date: protocol.date.slice(0, 10),
    },
    voters: counts,
    events,
    responsibles: protocol.responsibles,
  };
  if (protocol.visitors !== null) payload.visitors = protocol.visitors;
  if (protocol.attendance.length > 0) {
    payload.members = protocol.attendance.map((a) => ({
      fullname: a.fullname,
      posada: a.posada,
      present_text: a.present_text,
    }));
  }

  const logoFile = row.group?.logo_file;
  if (logoFile && !logoFile.deleted_at) {
    payload.logo = {
      _type: 'image',
      _props: {
        url: fileProxyUrl(logoFile.object_key),
        height: { unit: 'mm', value: PROTOCOL_LOGO_HEIGHT_MM },
      },
    };
  }

  return payload;
}

export type { AgendaChoiceVote };
