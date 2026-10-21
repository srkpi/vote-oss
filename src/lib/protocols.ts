import type { Prisma } from '@prisma/client';

import { PROTOCOL_LOGO_HEIGHT_MM, PROTOCOL_REQUIRED_ELECTION_CHOICES } from '@/lib/constants';
import { fileProxyUrl } from '@/lib/files';
import { prisma } from '@/lib/prisma';
import { validationMessage } from '@/lib/schemas/common';
import { protocolBodySchema } from '@/lib/schemas/protocol';
import { isAttendeePresentByText } from '@/lib/utils/protocol-gender';
import type {
  AgendaChoiceVote,
  Protocol,
  ProtocolAgendaItem,
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
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return [];
    }
    const obj = item as Record<string, unknown>;
    const fullname = typeof obj.fullname === 'string' ? obj.fullname : '';
    const speech = typeof obj.speech === 'string' ? obj.speech : '';
    return [{ fullname, speech }];
  });
}

function parseResponsibles(value: Prisma.JsonValue): ProtocolResponsible[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return [];
    }
    const obj = item as Record<string, unknown>;
    const posada = typeof obj.posada === 'string' ? obj.posada : '';
    const fullname = typeof obj.fullname === 'string' ? obj.fullname : '';
    return [{ posada, fullname }];
  });
}

function parseAttendance(value: Prisma.JsonValue): ProtocolAttendee[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return [];
    }
    const obj = item as Record<string, unknown>;
    const fullname = typeof obj.fullname === 'string' ? obj.fullname : '';
    const posada = typeof obj.posada === 'string' ? obj.posada : '';
    const present_text = typeof obj.present_text === 'string' ? obj.present_text : '';
    const userId = typeof obj.userId === 'string' ? obj.userId : null;
    return [{ userId, fullname, posada, present_text }];
  });
}

function parseChoiceMapping(value: Prisma.JsonValue | null): ProtocolChoiceMapping | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
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

export type { ValidatedProtocolBody } from '@/lib/schemas/protocol';

export function validateProtocolBody(input: unknown) {
  const result = protocolBodySchema.safeParse(input);
  if (!result.success) {
    return { ok: false as const, error: validationMessage(result.error) };
  }
  return { ok: true as const, data: result.data };
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
  if (!group) {
    throw new Error('Group not found while building OSS snapshot');
  }

  const fromGroup: ProtocolOssSnapshot = {
    name: group.full_name?.trim() || group.name,
    address: group.address ?? '',
    email: group.email ?? '',
    contact: group.contact ?? '',
  };

  if (!override) {
    return fromGroup;
  }
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
  attendees: ProtocolAttendee[],
): Promise<ProtocolComputedCounts> {
  const memberCount = await prisma.groupMember.count({
    where: { group_id: groupId, deleted_at: null },
  });

  let present = 0;
  for (const a of attendees) {
    if (isAttendeePresentByText(a.present_text)) {
      present++;
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
    if (m === 'yes') {
      yes += count;
    } else if (m === 'no') {
      no += count;
    } else if (m === 'abstain') {
      abstain += count;
    }
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
  if (!row) {
    throw new Error('Protocol not found');
  }

  const protocol = shapeProtocol(row);
  const counts = await computeProtocolCounts(protocol.groupId, protocol.attendance);

  const events: GeneratorEvent[] = row.agenda_items.map((rawAgenda, idx) => {
    const agenda = protocol.agendaItems[idx];
    const event: GeneratorEvent = {
      name: agenda.name,
      listeners: agenda.listeners,
    };
    if (agenda.result) {
      event.result = agenda.result;
    }
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
  if (protocol.visitors !== null) {
    payload.visitors = protocol.visitors;
  }
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
