export interface ProtocolListener {
  fullname: string;
  speech: string;
}

export interface ProtocolResponsible {
  posada: string;
  fullname: string;
}

export interface ProtocolAttendee {
  /** Optional reference to the GroupMember row this entry was sourced from. */
  userId: string | null;
  fullname: string;
  posada: string;
  present_text: string;
}

export type AgendaChoiceVote = 'yes' | 'no' | 'abstain';

export type ProtocolChoiceMapping = Record<string, AgendaChoiceVote>;

export interface ProtocolOssSnapshot {
  name: string;
  address: string;
  email: string;
  contact: string;
}

export interface ProtocolAgendaItem {
  id: string;
  position: number;
  name: string;
  listeners: ProtocolListener[];
  result: string | null;
  electionId: string | null;
  choiceMapping: ProtocolChoiceMapping | null;
}

export interface Protocol {
  id: string;
  groupId: string;
  number: number;
  name: string;
  date: string;
  visitors: number | null;
  responsibles: ProtocolResponsible[];
  attendance: ProtocolAttendee[];
  ossSnapshot: ProtocolOssSnapshot;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  agendaItems: ProtocolAgendaItem[];
}

export interface ProtocolSummary {
  id: string;
  groupId: string;
  number: number;
  name: string;
  date: string;
  agendaItemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProtocolAgendaItemInput {
  name: string;
  listeners: ProtocolListener[];
  result: string | null;
  electionId: string | null;
  choiceMapping: ProtocolChoiceMapping | null;
}

export interface CreateProtocolRequest {
  number: number;
  name: string;
  date: string;
  visitors: number | null;
  responsibles: ProtocolResponsible[];
  attendance: ProtocolAttendee[];
  agendaItems: ProtocolAgendaItemInput[];
  /** Optional override of the group's current requisites at creation time. */
  ossSnapshot?: Partial<ProtocolOssSnapshot>;
}

export type UpdateProtocolRequest = CreateProtocolRequest;

export interface ProtocolComputedCounts {
  total: number;
  present: number;
  quorum: number;
}
