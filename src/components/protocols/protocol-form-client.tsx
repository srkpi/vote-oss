'use client';

import {
  ArrowDown,
  ArrowUp,
  BuildingIcon,
  Download,
  Eye,
  Lock,
  Mail,
  MapPin,
  Phone,
  Plus,
  Trash2,
  Users,
  Vote,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { PageHeader } from '@/components/common/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField, Input, Textarea } from '@/components/ui/form';
import { StyledSelect } from '@/components/ui/styled-select';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import {
  PROTOCOL_ABSENT_TEXT_DEFAULT,
  PROTOCOL_AGENDA_ITEM_NAME_MAX_LENGTH,
  PROTOCOL_AGENDA_ITEM_RESULT_MAX_LENGTH,
  PROTOCOL_LISTENER_FULLNAME_MAX_LENGTH,
  PROTOCOL_LISTENER_SPEECH_MAX_LENGTH,
  PROTOCOL_MAX_AGENDA_ITEMS,
  PROTOCOL_MAX_ATTENDEES,
  PROTOCOL_MAX_LISTENERS_PER_ITEM,
  PROTOCOL_MAX_RESPONSIBLES,
  PROTOCOL_MAX_VISITORS,
  PROTOCOL_NAME_MAX_LENGTH,
  PROTOCOL_PRESENT_TEXT_DEFAULT,
  PROTOCOL_REQUIRED_ELECTION_CHOICES,
  PROTOCOL_RESPONSIBLE_FULLNAME_MAX_LENGTH,
  PROTOCOL_RESPONSIBLE_POSADA_MAX_LENGTH,
} from '@/lib/constants';
import { cn } from '@/lib/utils/common';
import type { Election } from '@/types/election';
import type { GroupDetail } from '@/types/group';
import type {
  AgendaChoiceVote,
  CreateProtocolRequest,
  Protocol,
  ProtocolAttendee,
  ProtocolChoiceMapping,
  ProtocolListener,
} from '@/types/protocol';

interface AgendaDraft {
  uid: string;
  name: string;
  listeners: ProtocolListener[];
  result: string;
  electionId: string | null;
  choiceMapping: ProtocolChoiceMapping;
}

interface ResponsibleDraft {
  uid: string;
  posada: string;
  fullname: string;
}

interface AttendeeDraft {
  uid: string;
  userId: string | null;
  fullname: string;
  posada: string;
  present_text: string;
  isPresent: boolean;
}

interface ProtocolFormClientProps {
  group: GroupDetail;
  initialProtocol: Protocol | null;
  /** Owner-only flag.  When false, the form is rendered read-only. */
  canEdit: boolean;
  /** Pre-fetched suggested number for the date's year (creation flow only). */
  initialNextNumber: number | null;
  /** Optional callback that switches the page to a read-only document view.
   *  Only available when editing an existing protocol — there's nothing to
   *  preview during creation. */
  onPreview?: () => void;
}

const VOTE_LABELS: Record<AgendaChoiceVote, string> = {
  yes: 'За',
  no: 'Проти',
  abstain: 'Утримались',
};

function uid(): string {
  return Math.random().toString(36).slice(2, 11);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function yearOf(dateStr: string): number {
  const y = parseInt(dateStr.slice(0, 4), 10);
  return Number.isFinite(y) ? y : new Date().getFullYear();
}

function emptyAgenda(): AgendaDraft {
  return {
    uid: uid(),
    name: '',
    listeners: [{ fullname: '', speech: '' }],
    result: '',
    electionId: null,
    choiceMapping: {},
  };
}

function deriveAttendees(
  members: GroupDetail['members'],
  saved: ProtocolAttendee[] | null,
): AttendeeDraft[] {
  // For an existing protocol, prefer the saved snapshot (so historical edits
  // remain stable even if member list changed), but include any *new* members
  // who joined since as absent rows for convenience.
  const savedByUserId = new Map<string, ProtocolAttendee>();
  const orphaned: ProtocolAttendee[] = [];
  for (const a of saved ?? []) {
    if (a.userId) savedByUserId.set(a.userId, a);
    else orphaned.push(a);
  }

  const result: AttendeeDraft[] = [];
  for (const m of members) {
    const s = savedByUserId.get(m.userId);
    if (s) {
      result.push({
        uid: uid(),
        userId: m.userId,
        fullname: s.fullname,
        posada: s.posada,
        present_text: s.present_text,
        isPresent: s.present_text.toLowerCase().includes(PROTOCOL_PRESENT_TEXT_DEFAULT),
      });
      savedByUserId.delete(m.userId);
    } else {
      result.push({
        uid: uid(),
        userId: m.userId,
        fullname: m.displayName,
        posada: m.role ?? '',
        present_text: PROTOCOL_ABSENT_TEXT_DEFAULT,
        isPresent: false,
      });
    }
  }

  // Saved entries whose member is no longer in the group
  for (const s of savedByUserId.values()) {
    result.push({
      uid: uid(),
      userId: s.userId,
      fullname: s.fullname,
      posada: s.posada,
      present_text: s.present_text,
      isPresent: s.present_text.toLowerCase().includes(PROTOCOL_PRESENT_TEXT_DEFAULT),
    });
  }
  // Manually-added rows (no userId)
  for (const s of orphaned) {
    result.push({
      uid: uid(),
      userId: null,
      fullname: s.fullname,
      posada: s.posada,
      present_text: s.present_text,
      isPresent: s.present_text.toLowerCase().includes(PROTOCOL_PRESENT_TEXT_DEFAULT),
    });
  }
  return result;
}

export function ProtocolFormClient({
  group,
  initialProtocol,
  canEdit,
  initialNextNumber,
  onPreview,
}: ProtocolFormClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const isEdit = !!initialProtocol;

  const [name, setName] = useState(initialProtocol?.name ?? '');
  const [date, setDate] = useState(initialProtocol?.date.slice(0, 10) ?? todayDate());
  const [number, setNumber] = useState<string>(
    initialProtocol?.number?.toString() ?? initialNextNumber?.toString() ?? '',
  );
  const numberManuallyEdited = useRef(false);
  const [visitors, setVisitors] = useState<string>(initialProtocol?.visitors?.toString() ?? '');

  const [agenda, setAgenda] = useState<AgendaDraft[]>(() => {
    if (initialProtocol && initialProtocol.agendaItems.length > 0) {
      return initialProtocol.agendaItems.map((a) => ({
        uid: uid(),
        name: a.name,
        listeners: a.listeners.length > 0 ? a.listeners : [{ fullname: '', speech: '' }],
        result: a.result ?? '',
        electionId: a.electionId,
        choiceMapping: a.choiceMapping ?? {},
      }));
    }
    return [emptyAgenda()];
  });

  const [responsibles, setResponsibles] = useState<ResponsibleDraft[]>(() => {
    if (initialProtocol && initialProtocol.responsibles.length > 0) {
      return initialProtocol.responsibles.map((r) => ({ uid: uid(), ...r }));
    }
    const owner = group.members.find((m) => m.isOwner);
    return [
      {
        uid: uid(),
        posada: owner?.role || 'Голова',
        fullname: owner?.displayName ?? '',
      },
    ];
  });

  const [attendees, setAttendees] = useState<AttendeeDraft[]>(() =>
    deriveAttendees(group.members, initialProtocol?.attendance ?? null),
  );

  // Decrypted voter cache per non-anonymous closed election.  Used to lock
  // attendance for everyone who voted — present is mechanically derived from
  // the ballot chain and cannot be flipped to absent.
  const [voterCache, setVoterCache] = useState<Map<string, { userId: string; fullName: string }[]>>(
    new Map(),
  );

  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Errors are reported in two places at once: an inline alert at the top of
  // the form (for users scrolled to the top) and a toast (visible regardless
  // of scroll position on long forms).
  const showError = (message: string) => {
    setError(message);
    toast({ title: 'Помилка', description: message, variant: 'error' });
  };

  // ── Auto-suggest protocol number on year change ──────────────────────────
  useEffect(() => {
    if (isEdit) return;
    if (numberManuallyEdited.current) return;
    const year = yearOf(date);
    if (initialNextNumber !== null && year === new Date().getFullYear() && number === '') {
      // already prefilled by parent
      return;
    }
    let cancelled = false;
    api.groups.protocols.listWithNextNumber(group.id, year).then((res) => {
      if (cancelled || !res.success) return;

      if (!numberManuallyEdited.current) setNumber(res.data.nextNumber.toString());
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, group.id, isEdit]);

  // ── Linkable elections (closed + 3 choices) ────────────────────────────────
  const linkableElections = useMemo(
    () =>
      group.elections.filter(
        (e) => e.status === 'closed' && e.choices.length === PROTOCOL_REQUIRED_ELECTION_CHOICES,
      ),
    [group.elections],
  );

  const electionsById = useMemo(() => {
    const m = new Map<string, Election>();
    for (const e of group.elections) m.set(e.id, e);
    return m;
  }, [group.elections]);

  const memberUserIds = useMemo(() => new Set(group.members.map((m) => m.userId)), [group.members]);

  // ── Voter sync from non-anonymous linked elections ─────────────────────────
  const linkedNonAnonElectionIds = useMemo<string[]>(() => {
    const ids = new Set<string>();
    for (const item of agenda) {
      if (!item.electionId) continue;
      const e = electionsById.get(item.electionId);
      if (e && !e.anonymous && e.status === 'closed') {
        ids.add(item.electionId);
      }
    }
    return Array.from(ids).sort();
  }, [agenda, electionsById]);

  const linkedNonAnonElectionIdsKey = linkedNonAnonElectionIds.join(',');

  // Fetch voters for any newly-linked non-anonymous closed election.
  useEffect(() => {
    if (!canEdit) return;
    const toFetch = linkedNonAnonElectionIds.filter((id) => !voterCache.has(id));
    if (toFetch.length === 0) return;
    let cancelled = false;
    Promise.all(toFetch.map((id) => api.elections.getVoters(id).then((res) => ({ id, res })))).then(
      (results) => {
        if (cancelled) return;
        setVoterCache((prev) => {
          const next = new Map(prev);
          for (const { id, res } of results) {
            if (res.success) next.set(id, res.data.voters);
            else next.set(id, []);
          }
          return next;
        });
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedNonAnonElectionIdsKey, canEdit]);

  const voterInfoByUserId = useMemo(() => {
    const map = new Map<string, { userId: string; fullName: string }>();
    for (const electionId of linkedNonAnonElectionIds) {
      const voters = voterCache.get(electionId);
      if (!voters) continue;
      for (const v of voters) {
        if (!map.has(v.userId)) map.set(v.userId, v);
      }
    }
    return map;
  }, [linkedNonAnonElectionIds, voterCache]);

  const lockedUserIds = useMemo(() => new Set(voterInfoByUserId.keys()), [voterInfoByUserId]);

  // Sync attendees with the decrypted voter set: force voters to present and
  // append rows for voters who aren't current group members.  This effect is a
  // legitimate "subscribe to derived external state" pattern — we receive
  // voters asynchronously from the server-side decryption and have to merge
  // them into the user-editable attendee list.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAttendees((prev) => {
      const existingUserIds = new Set(prev.filter((a) => a.userId !== null).map((a) => a.userId!));
      let changed = false;
      const updated = prev.map((a) => {
        if (a.userId && lockedUserIds.has(a.userId) && !a.isPresent) {
          changed = true;
          return {
            ...a,
            isPresent: true,
            present_text: PROTOCOL_PRESENT_TEXT_DEFAULT,
          };
        }
        return a;
      });
      const toAdd: AttendeeDraft[] = [];
      for (const [userId, info] of voterInfoByUserId) {
        if (!existingUserIds.has(userId)) {
          toAdd.push({
            uid: uid(),
            userId,
            fullname: info.fullName,
            posada: '',
            present_text: PROTOCOL_PRESENT_TEXT_DEFAULT,
            isPresent: true,
          });
        }
      }
      if (toAdd.length === 0 && !changed) return prev;
      return [...updated, ...toAdd];
    });
  }, [voterInfoByUserId, lockedUserIds]);

  // ── Live computed counts ──────────────────────────────────────────────────
  const counts = useMemo(() => {
    const total = group.memberCount;
    const quorum = Math.ceil((total * 2) / 3);
    let present = 0;
    for (const item of agenda) {
      if (!item.electionId) continue;
      const e = electionsById.get(item.electionId);
      if (e && e.ballotCount > present) present = e.ballotCount;
    }
    return { total, quorum, present };
  }, [group.memberCount, agenda, electionsById]);

  const presentCount = useMemo(() => attendees.filter((a) => a.isPresent).length, [attendees]);

  // ── Mutations on agenda ──────────────────────────────────────────────────
  const updateAgenda = (idx: number, patch: Partial<AgendaDraft>) => {
    setAgenda((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const addAgenda = () => {
    if (agenda.length >= PROTOCOL_MAX_AGENDA_ITEMS) return;
    setAgenda((prev) => [...prev, emptyAgenda()]);
  };

  const removeAgenda = (idx: number) => {
    if (agenda.length <= 1) return;
    setAgenda((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveAgenda = (idx: number, dir: -1 | 1) => {
    setAgenda((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return copy;
    });
  };

  const addListener = (idx: number) => {
    setAgenda((prev) =>
      prev.map((a, i) =>
        i === idx
          ? a.listeners.length >= PROTOCOL_MAX_LISTENERS_PER_ITEM
            ? a
            : { ...a, listeners: [...a.listeners, { fullname: '', speech: '' }] }
          : a,
      ),
    );
  };

  const updateListener = (idx: number, lIdx: number, patch: Partial<ProtocolListener>) => {
    setAgenda((prev) =>
      prev.map((a, i) =>
        i === idx
          ? { ...a, listeners: a.listeners.map((l, j) => (j === lIdx ? { ...l, ...patch } : l)) }
          : a,
      ),
    );
  };

  const removeListener = (idx: number, lIdx: number) => {
    setAgenda((prev) =>
      prev.map((a, i) =>
        i === idx && a.listeners.length > 1
          ? { ...a, listeners: a.listeners.filter((_, j) => j !== lIdx) }
          : a,
      ),
    );
  };

  const setElectionForAgenda = (idx: number, electionId: string | null) => {
    if (!electionId) {
      updateAgenda(idx, { electionId: null, choiceMapping: {} });
      return;
    }
    const e = electionsById.get(electionId);
    if (!e) return;
    const sorted = [...e.choices].sort((a, b) => a.position - b.position);
    const mapping: ProtocolChoiceMapping = {};
    const order: AgendaChoiceVote[] = ['yes', 'no', 'abstain'];
    sorted.forEach((c, j) => {
      mapping[c.id] = order[j] ?? 'abstain';
    });
    updateAgenda(idx, { electionId, choiceMapping: mapping });
  };

  const setChoiceVote = (idx: number, choiceId: string, vote: AgendaChoiceVote) => {
    setAgenda((prev) =>
      prev.map((a, i) =>
        i === idx ? { ...a, choiceMapping: { ...a.choiceMapping, [choiceId]: vote } } : a,
      ),
    );
  };

  // ── Mutations on responsibles ─────────────────────────────────────────────
  const addResponsible = () => {
    if (responsibles.length >= PROTOCOL_MAX_RESPONSIBLES) return;
    setResponsibles((prev) => [...prev, { uid: uid(), posada: '', fullname: '' }]);
  };

  const updateResponsible = (idx: number, patch: Partial<ResponsibleDraft>) => {
    setResponsibles((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeResponsible = (idx: number) => {
    if (responsibles.length <= 1) return;
    setResponsibles((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Mutations on attendees ────────────────────────────────────────────────
  const updateAttendee = (idx: number, patch: Partial<AttendeeDraft>) => {
    setAttendees((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const togglePresence = (idx: number, present: boolean) => {
    setAttendees((prev) =>
      prev.map((a, i) => {
        if (i !== idx) return a;
        // Voters from non-anonymous elections are mechanically present —
        // ignore attempts to mark them absent.
        if (a.userId && lockedUserIds.has(a.userId)) return a;
        return {
          ...a,
          isPresent: present,
          present_text: present ? PROTOCOL_PRESENT_TEXT_DEFAULT : PROTOCOL_ABSENT_TEXT_DEFAULT,
        };
      }),
    );
  };

  const addManualAttendee = () => {
    if (attendees.length >= PROTOCOL_MAX_ATTENDEES) return;
    setAttendees((prev) => [
      ...prev,
      {
        uid: uid(),
        userId: null,
        fullname: '',
        posada: '',
        present_text: PROTOCOL_PRESENT_TEXT_DEFAULT,
        isPresent: true,
      },
    ]);
  };

  const removeAttendee = (idx: number) => {
    setAttendees((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!name.trim()) return 'Вкажіть назву протоколу';
    if (!date) return 'Вкажіть дату протоколу';
    const numberValue = parseInt(number.trim(), 10);
    if (!Number.isFinite(numberValue) || numberValue < 1) {
      return 'Номер протоколу має бути цілим числом від 1';
    }
    for (const [i, r] of responsibles.entries()) {
      if (!r.posada.trim() || !r.fullname.trim()) {
        return `Заповніть посаду та ПІБ відповідального #${i + 1}`;
      }
    }
    for (const [i, a] of attendees.entries()) {
      if (!a.fullname.trim() || !a.posada.trim() || !a.present_text.trim()) {
        return `Заповніть всі поля для учасника #${i + 1} у листі присутності`;
      }
    }
    for (const [i, a] of agenda.entries()) {
      if (!a.name.trim()) return `Вкажіть назву пункту порядку денного #${i + 1}`;
      for (const [j, l] of a.listeners.entries()) {
        if (!l.fullname.trim() || !l.speech.trim()) {
          return `Заповніть слухача #${j + 1} у пункті #${i + 1}`;
        }
      }
      if (a.electionId) {
        const votes = new Set(Object.values(a.choiceMapping));
        if (Object.keys(a.choiceMapping).length !== PROTOCOL_REQUIRED_ELECTION_CHOICES) {
          return `Пункт #${i + 1}: змапте всі варіанти голосування`;
        }
        if (votes.size !== PROTOCOL_REQUIRED_ELECTION_CHOICES) {
          return `Пункт #${i + 1}: кожен варіант має відповідати окремому значенню (За/Проти/Утримались)`;
        }
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      showError(err);
      return;
    }
    setSubmitting(true);
    setError(null);

    const numberValue = parseInt(number.trim(), 10);
    const visitorsValue = visitors.trim() ? parseInt(visitors.trim(), 10) : null;

    const payload: CreateProtocolRequest = {
      number: numberValue,
      name: name.trim(),
      date,
      visitors: visitorsValue !== null && visitorsValue >= 0 ? visitorsValue : null,
      responsibles: responsibles.map((r) => ({
        posada: r.posada.trim(),
        fullname: r.fullname.trim(),
      })),
      attendance: attendees.map((a) => ({
        userId: a.userId,
        fullname: a.fullname.trim(),
        posada: a.posada.trim(),
        present_text: a.present_text.trim(),
      })),
      agendaItems: agenda.map((a) => ({
        name: a.name.trim(),
        listeners: a.listeners.map((l) => ({
          fullname: l.fullname.trim(),
          speech: l.speech.trim(),
        })),
        result: a.result.trim() || null,
        electionId: a.electionId,
        choiceMapping: a.electionId ? a.choiceMapping : null,
      })),
    };

    const result =
      isEdit && initialProtocol
        ? await api.protocols.update(initialProtocol.id, payload)
        : await api.groups.protocols.create(group.id, payload);

    if (result.success) {
      toast({
        title: isEdit ? 'Протокол оновлено' : 'Протокол створено',
        variant: 'success',
      });
      if (!isEdit) {
        router.push(`/groups/${group.id}/protocols/${result.data.id}`);
      } else {
        router.refresh();
      }
    } else {
      showError(result.error);
    }
    setSubmitting(false);
  };

  const handleGenerate = async () => {
    if (!initialProtocol) return;
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch(`/api/protocols/${initialProtocol.id}/generate`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        let message = `Помилка генерації (${response.status})`;
        try {
          const body = await response.json();
          if (body && typeof body.message === 'string') message = body.message;
        } catch {
          /* ignore parse errors */
        }
        showError(message);
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') ?? '';
      const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/.exec(disposition);
      const filename = match
        ? decodeURIComponent(match[1] ?? match[2] ?? 'protocol.pdf')
        : 'protocol.pdf';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'PDF згенеровано', variant: 'success' });
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Помилка мережі');
    } finally {
      setGenerating(false);
    }
  };

  // ── OSS snapshot for display ──────────────────────────────────────────────
  const ossDisplay = initialProtocol
    ? initialProtocol.ossSnapshot
    : {
        name: group.requisites.fullName || group.name,
        address: group.requisites.address ?? '',
        email: group.requisites.email ?? '',
        contact: group.requisites.contact ?? '',
      };

  const missingRequisites =
    !ossDisplay.name || !ossDisplay.address || !ossDisplay.email || !ossDisplay.contact;

  return (
    <>
      <PageHeader
        nav={[
          { label: 'Групи', href: '/groups' },
          { label: group.name, href: `/groups/${group.id}` },
          { label: isEdit ? initialProtocol?.name || 'Протокол' : 'Новий протокол' },
        ]}
        title={isEdit ? 'Протокол' : 'Новий протокол'}
        isContainer
      />

      <div className="container py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {!canEdit && (
            <Alert variant="info">
              Перегляд тільки для читання. Редагувати може лише власник групи.
            </Alert>
          )}
          {error && (
            <Alert variant="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          {missingRequisites && !isEdit && (
            <Alert variant="warning" title="Реквізити групи не повні">
              Деякі поля реквізитів пусті — їх можна заповнити на сторінці{' '}
              <Link href={`/groups/${group.id}`} className="underline">
                групи
              </Link>
              . Без них генерація PDF не вдасться.
            </Alert>
          )}

          {/* Requisites snapshot */}
          <SectionCard title="Реквізити" subtitle="Підтягуються з групи на момент створення">
            <div className="space-y-2">
              <RequisiteLine
                icon={<BuildingIcon className="h-3.5 w-3.5" />}
                label="Назва"
                value={ossDisplay.name || '—'}
              />
              <RequisiteLine
                icon={<MapPin className="h-3.5 w-3.5" />}
                label="Адреса"
                value={ossDisplay.address || '—'}
              />
              <RequisiteLine
                icon={<Mail className="h-3.5 w-3.5" />}
                label="Ел. пошта"
                value={ossDisplay.email || '—'}
              />
              <RequisiteLine
                icon={<Phone className="h-3.5 w-3.5" />}
                label="Контакт"
                value={ossDisplay.contact || '—'}
              />
            </div>
          </SectionCard>

          {/* Protocol meta */}
          <SectionCard title="Інформація про протокол">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Назва" required htmlFor="protocol-name" className="sm:col-span-2">
                <Input
                  id="protocol-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={PROTOCOL_NAME_MAX_LENGTH}
                  placeholder="Наприклад: Засідання правління"
                  disabled={!canEdit}
                />
              </FormField>
              <FormField label="Дата" required htmlFor="protocol-date">
                <Input
                  id="protocol-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={!canEdit}
                />
              </FormField>
              <FormField label="Номер" required htmlFor="protocol-number">
                <Input
                  id="protocol-number"
                  type="number"
                  min={1}
                  value={number}
                  onChange={(e) => {
                    numberManuallyEdited.current = true;
                    setNumber(e.target.value);
                  }}
                  placeholder="Наступний номер для року"
                  disabled={!canEdit}
                />
              </FormField>
              <FormField
                label="Запрошених гостей (необов'язково)"
                htmlFor="protocol-visitors"
                className="sm:col-span-2"
              >
                <Input
                  id="protocol-visitors"
                  type="number"
                  min={0}
                  max={PROTOCOL_MAX_VISITORS}
                  value={visitors}
                  onChange={(e) => setVisitors(e.target.value)}
                  placeholder="0"
                  disabled={!canEdit}
                />
              </FormField>
            </div>
          </SectionCard>

          {/* Computed counts */}
          <SectionCard title="Обраховані показники" subtitle="Розраховуються автоматично">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <CountTile
                icon={<Users className="h-4 w-4" />}
                label="Усього членів"
                value={counts.total}
              />
              <CountTile
                icon={<Users className="h-4 w-4" />}
                label="Кворум (2/3)"
                value={counts.quorum}
              />
              <CountTile
                icon={<Vote className="h-4 w-4" />}
                label="Присутні"
                value={counts.present}
                hint="Максимум бюлетенів серед привʼязаних голосувань"
              />
            </div>
          </SectionCard>

          {/* Agenda */}
          <SectionCard
            title="Порядок денний"
            subtitle="Кожен пункт — окреме питання, яке розглядалось"
            action={
              canEdit ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addAgenda}
                  disabled={agenda.length >= PROTOCOL_MAX_AGENDA_ITEMS}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Додати пункт
                </Button>
              ) : null
            }
          >
            <div className="space-y-4">
              {agenda.map((item, idx) => (
                <AgendaItemEditor
                  key={item.uid}
                  index={idx}
                  total={agenda.length}
                  item={item}
                  linkableElections={linkableElections}
                  electionsById={electionsById}
                  canEdit={canEdit}
                  onChange={(patch) => updateAgenda(idx, patch)}
                  onRemove={() => removeAgenda(idx)}
                  onMove={(dir) => moveAgenda(idx, dir)}
                  onAddListener={() => addListener(idx)}
                  onUpdateListener={(lIdx, patch) => updateListener(idx, lIdx, patch)}
                  onRemoveListener={(lIdx) => removeListener(idx, lIdx)}
                  onSelectElection={(eid) => setElectionForAgenda(idx, eid)}
                  onSetChoiceVote={(cid, vote) => setChoiceVote(idx, cid, vote)}
                />
              ))}
            </div>
          </SectionCard>

          {/* Responsibles */}
          <SectionCard
            title="Відповідальні"
            subtitle="Особи, які підписують протокол"
            action={
              canEdit ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addResponsible}
                  disabled={responsibles.length >= PROTOCOL_MAX_RESPONSIBLES}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Додати
                </Button>
              ) : null
            }
          >
            <div className="space-y-3">
              {responsibles.map((r, idx) => (
                <div key={r.uid} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <Input
                    value={r.posada}
                    onChange={(e) => updateResponsible(idx, { posada: e.target.value })}
                    placeholder="Посада (наприклад: Голова)"
                    maxLength={PROTOCOL_RESPONSIBLE_POSADA_MAX_LENGTH}
                    disabled={!canEdit}
                  />
                  <Input
                    value={r.fullname}
                    onChange={(e) => updateResponsible(idx, { fullname: e.target.value })}
                    placeholder="Прізвище Імʼя"
                    maxLength={PROTOCOL_RESPONSIBLE_FULLNAME_MAX_LENGTH}
                    disabled={!canEdit}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeResponsible(idx)}
                    disabled={!canEdit || responsibles.length <= 1}
                    className="text-error hover:bg-error-bg"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Attendance */}
          <SectionCard
            title="Лист присутності"
            subtitle={`Відмічено присутніх: ${presentCount} / ${attendees.length}`}
            action={
              canEdit ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addManualAttendee}
                  disabled={attendees.length >= PROTOCOL_MAX_ATTENDEES}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Додати рядок
                </Button>
              ) : null
            }
          >
            {attendees.length === 0 ? (
              <p className="font-body text-muted-foreground py-4 text-center text-sm">
                Учасників ще немає
              </p>
            ) : (
              <div className="space-y-2">
                {attendees.map((a, idx) => {
                  const isLockedByVote = a.userId !== null && lockedUserIds.has(a.userId);
                  const isMember = a.userId !== null && memberUserIds.has(a.userId);
                  const canDelete = canEdit && !isLockedByVote && !isMember;
                  return (
                    <div
                      key={a.uid}
                      className={cn(
                        'border-border-subtle rounded-md border p-3',
                        a.isPresent ? 'bg-success-bg/20' : 'bg-surface',
                      )}
                    >
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center">
                        <Input
                          value={a.fullname}
                          onChange={(e) => updateAttendee(idx, { fullname: e.target.value })}
                          placeholder="ПІБ"
                          maxLength={PROTOCOL_RESPONSIBLE_FULLNAME_MAX_LENGTH}
                          disabled={!canEdit}
                        />
                        <Input
                          value={a.posada}
                          onChange={(e) => updateAttendee(idx, { posada: e.target.value })}
                          placeholder="Посада"
                          maxLength={PROTOCOL_RESPONSIBLE_POSADA_MAX_LENGTH}
                          disabled={!canEdit}
                        />
                        <StyledSelect
                          value={a.isPresent ? 'present' : 'absent'}
                          onChange={(v) => togglePresence(idx, v === 'present')}
                          disabled={!canEdit || isLockedByVote}
                          aria-label="Присутність"
                          className="sm:w-40"
                          options={[
                            { value: 'present', label: 'Присутній' },
                            { value: 'absent', label: 'Відсутній' },
                          ]}
                        />
                        {canDelete ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeAttendee(idx)}
                            className="text-error hover:bg-error-bg"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <span className="hidden sm:block sm:w-10" aria-hidden="true" />
                        )}
                      </div>
                      {isLockedByVote && (
                        <p className="text-success mt-1.5 flex items-center gap-1 text-xs">
                          <Lock className="h-3 w-3 shrink-0" />
                          Підтверджено голосуванням — присутність не можна змінити
                          {!isMember && ' (не входить до групи)'}
                        </p>
                      )}
                      {!isLockedByVote && a.userId === null && (
                        <p className="text-muted-foreground mt-1.5 text-xs">
                          Ручний рядок (не зі списку учасників групи)
                        </p>
                      )}
                      {!isLockedByVote && a.userId !== null && !isMember && (
                        <p className="text-muted-foreground mt-1.5 text-xs">
                          Колишній учасник групи
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button variant="secondary" asChild disabled={submitting || generating}>
              <Link href={`/groups/${group.id}`}>{canEdit ? 'Скасувати' : 'Назад до групи'}</Link>
            </Button>
            {onPreview && isEdit && (
              <Button
                variant="secondary"
                onClick={onPreview}
                disabled={submitting || generating}
                icon={<Eye className="h-3.5 w-3.5" />}
              >
                Переглянути як документ
              </Button>
            )}
            {isEdit && (
              <Button
                variant="outline"
                onClick={handleGenerate}
                loading={generating}
                disabled={submitting}
                icon={<Download className="h-3.5 w-3.5" />}
              >
                Згенерувати PDF
              </Button>
            )}
            {canEdit && (
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={submitting}
                disabled={generating}
              >
                {isEdit ? 'Зберегти зміни' : 'Створити протокол'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border-color shadow-shadow-card rounded-xl border bg-white">
      <div className="border-border-subtle flex items-center justify-between gap-4 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-display text-foreground text-base font-semibold">{title}</h2>
          {subtitle && <p className="font-body text-muted-foreground mt-0.5 text-xs">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function RequisiteLine({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {icon && <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>}
      <span className="text-muted-foreground w-24 shrink-0 text-xs">{label}</span>
      <span className="text-foreground font-body wrap-break-word">{value}</span>
    </div>
  );
}

function CountTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="border-border-subtle bg-surface space-y-1 rounded-lg border p-3">
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <p className="font-display text-foreground text-2xl font-semibold">{value}</p>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

interface AgendaItemEditorProps {
  index: number;
  total: number;
  item: AgendaDraft;
  linkableElections: Election[];
  electionsById: Map<string, Election>;
  canEdit: boolean;
  onChange: (patch: Partial<AgendaDraft>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onAddListener: () => void;
  onUpdateListener: (lIdx: number, patch: Partial<ProtocolListener>) => void;
  onRemoveListener: (lIdx: number) => void;
  onSelectElection: (eid: string | null) => void;
  onSetChoiceVote: (cid: string, vote: AgendaChoiceVote) => void;
}

function AgendaItemEditor({
  index,
  total,
  item,
  linkableElections,
  electionsById,
  canEdit,
  onChange,
  onRemove,
  onMove,
  onAddListener,
  onUpdateListener,
  onRemoveListener,
  onSelectElection,
  onSetChoiceVote,
}: AgendaItemEditorProps) {
  const linkedElection = item.electionId ? (electionsById.get(item.electionId) ?? null) : null;
  const sortedChoices = useMemo(() => {
    if (!linkedElection) return [];
    return [...linkedElection.choices].sort((a, b) => a.position - b.position);
  }, [linkedElection]);

  return (
    <div className="border-border-color rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="bg-kpi-navy/10 text-kpi-navy flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold">
            {index + 1}
          </span>
          <p className="font-body text-foreground text-sm font-semibold">Пункт {index + 1}</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onMove(-1)}
              disabled={index === 0}
              title="Вгору"
              className="text-muted-foreground"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onMove(1)}
              disabled={index === total - 1}
              title="Вниз"
              className="text-muted-foreground"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={onRemove}
              disabled={total <= 1}
              className="text-error hover:bg-error-bg"
              title="Видалити пункт"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <FormField label="Назва пункту" required>
          <Input
            value={item.name}
            onChange={(e) => onChange({ name: e.target.value })}
            maxLength={PROTOCOL_AGENDA_ITEM_NAME_MAX_LENGTH}
            placeholder="Про затвердження..."
            disabled={!canEdit}
          />
        </FormField>

        <FormField label="Слухали">
          <div className="space-y-2">
            {item.listeners.map((l, lIdx) => (
              <div key={lIdx} className="border-border-subtle rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">Слухач #{lIdx + 1}</span>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => onRemoveListener(lIdx)}
                      disabled={item.listeners.length <= 1}
                      className="text-error hover:bg-error-bg"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <Input
                  className="mb-2"
                  value={l.fullname}
                  onChange={(e) => onUpdateListener(lIdx, { fullname: e.target.value })}
                  placeholder="ПІБ"
                  maxLength={PROTOCOL_LISTENER_FULLNAME_MAX_LENGTH}
                  disabled={!canEdit}
                />
                <Textarea
                  rows={3}
                  value={l.speech}
                  onChange={(e) => onUpdateListener(lIdx, { speech: e.target.value })}
                  placeholder="Зміст виступу"
                  maxLength={PROTOCOL_LISTENER_SPEECH_MAX_LENGTH}
                  disabled={!canEdit}
                />
              </div>
            ))}
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onAddListener}
                disabled={item.listeners.length >= PROTOCOL_MAX_LISTENERS_PER_ITEM}
              >
                <Plus className="h-3.5 w-3.5" />
                Додати слухача
              </Button>
            )}
          </div>
        </FormField>

        <FormField label="Постановили (необовʼязково)">
          <Textarea
            rows={3}
            value={item.result}
            onChange={(e) => onChange({ result: e.target.value })}
            maxLength={PROTOCOL_AGENDA_ITEM_RESULT_MAX_LENGTH}
            placeholder="Текст постанови"
            disabled={!canEdit}
          />
        </FormField>

        <FormField
          label="Привʼязане голосування (необовʼязково)"
          hint={
            linkableElections.length === 0 && canEdit
              ? `Доступних немає — потрібно завершене голосування з ${PROTOCOL_REQUIRED_ELECTION_CHOICES} варіантами`
              : undefined
          }
        >
          <StyledSelect
            value={item.electionId ?? ''}
            onChange={(v) => onSelectElection(v || null)}
            disabled={!canEdit}
            options={[
              { value: '', label: '— Без привʼязки —' },
              ...linkableElections.map((e) => ({ value: e.id, label: e.title })),
              ...(item.electionId && !linkableElections.some((e) => e.id === item.electionId)
                ? [
                    {
                      value: item.electionId,
                      label: electionsById.get(item.electionId)?.title ?? '(недоступне)',
                    },
                  ]
                : []),
            ]}
          />
        </FormField>

        {linkedElection && (
          <div className="border-border-subtle bg-surface rounded-md border p-3">
            <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
              Мапінг варіантів — За / Проти / Утримались
            </p>
            <div className="space-y-2">
              {sortedChoices.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground text-sm">{c.choice}</p>
                    <p className="text-muted-foreground text-xs">Голосів: {c.votes ?? 0}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {(['yes', 'no', 'abstain'] as AgendaChoiceVote[]).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => onSetChoiceVote(c.id, v)}
                        disabled={!canEdit}
                        className={cn(
                          'rounded-md border px-3 py-1 text-xs transition-colors',
                          item.choiceMapping[c.id] === v
                            ? 'bg-kpi-navy border-kpi-navy text-white'
                            : 'border-border-color hover:border-kpi-blue-light text-foreground bg-white',
                          !canEdit && 'cursor-not-allowed opacity-60',
                        )}
                      >
                        {VOTE_LABELS[v]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
