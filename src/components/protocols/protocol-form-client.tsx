'use client';

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BuildingIcon,
  Check,
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
  PRESENT_TEXT_MALE,
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
  PROTOCOL_REQUIRED_ELECTION_CHOICES,
  PROTOCOL_RESPONSIBLE_FULLNAME_MAX_LENGTH,
  PROTOCOL_RESPONSIBLE_POSADA_MAX_LENGTH,
} from '@/lib/constants';
import { capitalizeFirst, cn } from '@/lib/utils/common';
import { type AttendeeDraft, deriveAttendees } from '@/lib/utils/protocol-attendees';
import {
  getGenderedAbsentText,
  getGenderedPresentText,
  rederivePresenceText,
} from '@/lib/utils/protocol-gender';
import { compareByRoleImportance } from '@/lib/utils/protocol-role-priority';
import type { Election } from '@/types/election';
import type { GroupDetail } from '@/types/group';
import type {
  AgendaChoiceVote,
  CreateProtocolRequest,
  Protocol,
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

type QuickSortKey = 'smart' | 'fullname' | 'posada' | 'posada-fullname';

const QUICK_SORT_KEYS: QuickSortKey[] = ['smart', 'fullname', 'posada', 'posada-fullname'];

const QUICK_SORT_LABELS: Record<QuickSortKey, string> = {
  smart: 'За важливістю',
  fullname: 'ПІБ',
  posada: 'Посада',
  'posada-fullname': 'Посада → ПІБ',
};

function compareByQuickSortKey<T extends { fullname: string; posada: string }>(
  key: QuickSortKey,
): (a: T, b: T) => number {
  if (key === 'smart') return compareByRoleImportance;
  return (a, b) => {
    if (key === 'fullname') return a.fullname.localeCompare(b.fullname, 'uk');
    if (key === 'posada') return a.posada.localeCompare(b.posada, 'uk');
    return a.posada.localeCompare(b.posada, 'uk') || a.fullname.localeCompare(b.fullname, 'uk');
  };
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

  const [attendees, setAttendees] = useState<AttendeeDraft[]>(() => {
    const derived = deriveAttendees(group.members, initialProtocol?.attendance ?? null);
    // A brand-new protocol has no saved order yet, so start from the "smart"
    // role-importance order instead of the raw (join-date) member order —
    // see responsiblesSortKey/attendeesSortKey below.
    return isEdit ? derived : [...derived].sort(compareByRoleImportance);
  });

  // Tracks which quick-sort chip (if any) the current order matches, so it
  // can be highlighted. `null` means the order is custom (manually
  // rearranged, or loaded as-is from a saved protocol) and no chip should be
  // highlighted. New, not-yet-created protocols default to "smart" so the
  // owner sees an already-sensibly-ordered list instead of raw join order.
  const [responsiblesSortKey, setResponsiblesSortKey] = useState<QuickSortKey | null>(
    isEdit ? null : 'smart',
  );
  const [attendeesSortKey, setAttendeesSortKey] = useState<QuickSortKey | null>(
    isEdit ? null : 'smart',
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
  const linkedNonAnonElectionIds: string[] = (() => {
    const ids = new Set<string>();
    for (const item of agenda) {
      if (!item.electionId) continue;
      const e = electionsById.get(item.electionId);
      if (e && !e.anonymous && e.status === 'closed') {
        ids.add(item.electionId);
      }
    }
    return Array.from(ids).sort();
  })();

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
  // append rows for voters who aren't current group members.  Gender-aware
  // present text is derived from the voter's full name.
  useEffect(() => {
    const syncedLockedUserIds = new Set(voterInfoByUserId.keys());
    let addedNewAttendee = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAttendees((prev) => {
      const existingUserIds = new Set(prev.filter((a) => a.userId !== null).map((a) => a.userId!));
      let changed = false;
      const updated = prev.map((a) => {
        if (a.userId && syncedLockedUserIds.has(a.userId) && !a.isPresent) {
          changed = true;
          return {
            ...a,
            isPresent: true,
            // Derive the gender-appropriate present text from the stored fullname
            present_text: getGenderedPresentText(a.fullname),
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
            present_text: getGenderedPresentText(info.fullName),
            isPresent: true,
          });
        }
      }
      if (toAdd.length === 0 && !changed) return prev;
      addedNewAttendee = toAdd.length > 0;
      return [...updated, ...toAdd];
    });

    if (addedNewAttendee) {
      setAttendeesSortKey(null);
    }
  }, [voterInfoByUserId]);

  // ── Live computed counts ──────────────────────────────────────────────────
  const counts = (() => {
    const total = group.memberCount;
    const quorum = Math.ceil((total * 2) / 3);
    let present = 0;
    for (const item of agenda) {
      if (!item.electionId) continue;
      const e = electionsById.get(item.electionId);
      if (e && e.ballotCount > present) present = e.ballotCount;
    }
    return { total, quorum, present };
  })();

  const presentCount = attendees.filter((a) => a.isPresent).length;

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
    setResponsiblesSortKey(null);
  };

  const updateResponsible = (idx: number, patch: Partial<ResponsibleDraft>) => {
    setResponsibles((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    if ('posada' in patch || 'fullname' in patch) setResponsiblesSortKey(null);
  };

  const removeResponsible = (idx: number) => {
    if (responsibles.length <= 1) return;
    setResponsibles((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveResponsible = (idx: number, dir: -1 | 1) => {
    setResponsibles((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return copy;
    });
    setResponsiblesSortKey(null);
  };

  const sortResponsibles = (key: QuickSortKey) => {
    setResponsibles((prev) => [...prev].sort(compareByQuickSortKey(key)));
    setResponsiblesSortKey(key);
  };

  // ── Mutations on attendees ────────────────────────────────────────────────

  /**
   * Update an attendee draft.  When the fullname changes and the current
   * present_text is one of the four standard gendered variants
   * (присутній / присутня / відсутній / відсутня), it is automatically
   * re-derived to match the new name's gender.  Custom values are left alone.
   */
  const updateAttendee = (idx: number, patch: Partial<AttendeeDraft>) => {
    setAttendees((prev) =>
      prev.map((a, i) => {
        if (i !== idx) return a;
        const merged = { ...a, ...patch };
        if ('fullname' in patch) {
          merged.present_text = rederivePresenceText(merged.present_text, merged.fullname);
        }
        return merged;
      }),
    );
    if ('posada' in patch || 'fullname' in patch) setAttendeesSortKey(null);
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
          // Derive gender-appropriate text from the attendee's stored fullname
          present_text: present
            ? getGenderedPresentText(a.fullname)
            : getGenderedAbsentText(a.fullname),
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
        // Empty name → default to male form; will re-derive once name is typed
        present_text: PRESENT_TEXT_MALE,
        isPresent: true,
      },
    ]);
    setAttendeesSortKey(null);
  };

  const removeAttendee = (idx: number) => {
    setAttendees((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveAttendee = (idx: number, dir: -1 | 1) => {
    setAttendees((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return copy;
    });
    setAttendeesSortKey(null);
  };

  const sortAttendees = (key: QuickSortKey) => {
    setAttendees((prev) => [...prev].sort(compareByQuickSortKey(key)));
    setAttendeesSortKey(key);
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
      if (!a.electionId) {
        return `Пункт #${i + 1}: оберіть привʼязане голосування`;
      }
      const votes = new Set(Object.values(a.choiceMapping));
      if (Object.keys(a.choiceMapping).length !== PROTOCOL_REQUIRED_ELECTION_CHOICES) {
        return `Пункт #${i + 1}: змапте всі варіанти голосування`;
      }
      if (votes.size !== PROTOCOL_REQUIRED_ELECTION_CHOICES) {
        return `Пункт #${i + 1}: кожен варіант має відповідати окремому значенню (За/Проти/Утримались)`;
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
            {canEdit && responsibles.length > 1 && (
              <QuickSortBar activeKey={responsiblesSortKey} onSort={sortResponsibles} />
            )}
            <div className="space-y-3">
              {responsibles.map((r, idx) => (
                <div
                  key={r.uid}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center"
                >
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
                  <div className="flex items-center justify-end gap-1">
                    <ReorderButtons
                      onMoveUp={() => moveResponsible(idx, -1)}
                      onMoveDown={() => moveResponsible(idx, 1)}
                      disabledUp={!canEdit || idx === 0}
                      disabledDown={!canEdit || idx === responsibles.length - 1}
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
            {canEdit && attendees.length > 1 && (
              <QuickSortBar activeKey={attendeesSortKey} onSort={sortAttendees} />
            )}
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
                            {
                              value: 'present',
                              label: capitalizeFirst(getGenderedPresentText(a.fullname)),
                            },
                            {
                              value: 'absent',
                              label: capitalizeFirst(getGenderedAbsentText(a.fullname)),
                            },
                          ]}
                        />
                        <div className="flex items-center justify-end gap-1">
                          <ReorderButtons
                            onMoveUp={() => moveAttendee(idx, -1)}
                            onMoveDown={() => moveAttendee(idx, 1)}
                            disabledUp={!canEdit || idx === 0}
                            disabledDown={!canEdit || idx === attendees.length - 1}
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
                            <span className="w-9" aria-hidden="true" />
                          )}
                        </div>
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
    <div className="border-border-color shadow-card rounded-xl border bg-white">
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

function ReorderButtons({
  onMoveUp,
  onMoveDown,
  disabledUp,
  disabledDown,
}: {
  onMoveUp: () => void;
  onMoveDown: () => void;
  disabledUp: boolean;
  disabledDown: boolean;
}) {
  return (
    <>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onMoveUp}
        disabled={disabledUp}
        title="Вгору"
        className="text-muted-foreground"
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onMoveDown}
        disabled={disabledDown}
        title="Вниз"
        className="text-muted-foreground"
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </Button>
    </>
  );
}

function QuickSortBar({
  activeKey,
  onSort,
}: {
  activeKey: QuickSortKey | null;
  onSort: (key: QuickSortKey) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground flex items-center gap-1 text-xs">
        <ArrowUpDown className="h-3 w-3" />
        Сортувати:
      </span>
      {QUICK_SORT_KEYS.map((key) => {
        const isActive = key === activeKey;
        return (
          <Button
            key={key}
            variant={isActive ? 'primary' : 'secondary'}
            size="xs"
            onClick={() => onSort(key)}
            aria-pressed={isActive}
          >
            {isActive && <Check className="h-3 w-3" />}
            {QUICK_SORT_LABELS[key]}
          </Button>
        );
      })}
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
  const sortedChoices = (() => {
    if (!linkedElection) return [];
    return [...linkedElection.choices].sort((a, b) => a.position - b.position);
  })();

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
          label="Привʼязане голосування"
          required
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
              { value: '', label: '— Оберіть голосування —' },
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
