'use client';

import { zodResolver } from '@hookform/resolvers/zod';
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
import {
  useForm,
  useFieldArray,
  useWatch,
  type Control,
  type UseFormRegister,
  type FieldErrors,
} from 'react-hook-form';

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
import {
  protocolFormSchema,
  serializeProtocolForm,
  type ProtocolFormValues,
} from '@/lib/schemas/protocol-form';
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
  Protocol,
  ProtocolChoiceMapping,
  ProtocolListener,
} from '@/types/protocol';

interface AgendaDraft {
  name: string;
  listeners: ProtocolListener[];
  result: string;
  electionId: string | null;
  choiceMapping: ProtocolChoiceMapping;
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
  if (key === 'smart') {
    return compareByRoleImportance;
  }
  return (a, b) => {
    if (key === 'fullname') {
      return a.fullname.localeCompare(b.fullname, 'uk');
    }
    if (key === 'posada') {
      return a.posada.localeCompare(b.posada, 'uk');
    }
    return a.posada.localeCompare(b.posada, 'uk') || a.fullname.localeCompare(b.fullname, 'uk');
  };
}

function protocolDefaults(
  group: GroupDetail,
  initialProtocol: Protocol | null,
  initialNextNumber: number | null,
): ProtocolFormValues {
  const isEdit = !!initialProtocol;
  return {
    name: initialProtocol?.name ?? '',
    date: initialProtocol?.date.slice(0, 10) ?? todayDate(),
    number: initialProtocol?.number?.toString() ?? initialNextNumber?.toString() ?? '',
    visitors: initialProtocol?.visitors?.toString() ?? '',
    agenda: (() => {
      if (initialProtocol && initialProtocol.agendaItems.length > 0) {
        return initialProtocol.agendaItems.map((a) => ({
          name: a.name,
          listeners: a.listeners.length > 0 ? a.listeners : [{ fullname: '', speech: '' }],
          result: a.result ?? '',
          electionId: a.electionId,
          choiceMapping: a.choiceMapping ?? {},
        }));
      }
      return [emptyAgenda()];
    })(),
    responsibles: (() => {
      if (initialProtocol && initialProtocol.responsibles.length > 0) {
        return initialProtocol.responsibles.map((r) => ({ ...r }));
      }
      const owner = group.members.find((m) => m.isOwner);
      return [
        {
          posada: owner?.role || 'Голова',
          fullname: owner?.displayName ?? '',
        },
      ];
    })(),
    attendees: (() => {
      const derived = deriveAttendees(group.members, initialProtocol?.attendance ?? null);
      // A brand-new protocol has no saved order yet, so start from the "smart"
      // role-importance order instead of the raw (join-date) member order —
      // see responsiblesSortKey/attendeesSortKey below.
      return isEdit ? derived : [...derived].sort(compareByRoleImportance);
    })(),
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

  const numberManuallyEdited = useRef(false);
  const [defaultValues] = useState(() =>
    protocolDefaults(group, initialProtocol, initialNextNumber),
  );
  const {
    control,
    register,
    handleSubmit: submitForm,
    setValue,
    getValues,
    setError,
    clearErrors,
    formState: { errors, isSubmitting: submitting, isSubmitted },
  } = useForm<ProtocolFormValues>({
    resolver: zodResolver(protocolFormSchema),
    defaultValues,
  });
  const { date, number, agenda, responsibles, attendees } = useWatch({
    control,
  }) as ProtocolFormValues;
  const agendaFields = useFieldArray({ control, name: 'agenda' });
  const responsibleFields = useFieldArray({ control, name: 'responsibles' });
  const attendeeFields = useFieldArray({ control, name: 'attendees' });
  const { append: appendAttendees } = attendeeFields;
  const agendaRows = agendaFields.fields.map((field, index) => ({ ...field, ...agenda[index] }));
  const responsibleRows = responsibleFields.fields.map((field, index) => ({
    ...field,
    ...responsibles[index],
  }));
  const attendeeRows = attendeeFields.fields.map((field, index) => ({
    ...field,
    ...attendees[index],
  }));
  const error = errors.root?.message;

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

  const [generating, setGenerating] = useState(false);

  // Errors are reported in two places at once: an inline alert at the top of
  // the form (for users scrolled to the top) and a toast (visible regardless
  // of scroll position on long forms).
  const showError = (message: string) => {
    setError('root', { message });
    toast({ title: 'Помилка', description: message, variant: 'error' });
  };

  // ── Auto-suggest protocol number on year change ──────────────────────────
  useEffect(() => {
    if (isEdit) {
      return;
    }
    if (numberManuallyEdited.current) {
      return;
    }
    const year = yearOf(date);
    if (initialNextNumber !== null && year === new Date().getFullYear() && number === '') {
      // already prefilled by parent
      return;
    }
    let cancelled = false;
    api.groups.protocols.listWithNextNumber(group.id, year).then((res) => {
      if (cancelled || !res.success) {
        return;
      }

      if (!numberManuallyEdited.current) {
        setValue('number', res.data.nextNumber.toString());
      }
    });
    return () => {
      cancelled = true;
    };
    // oxlint-disable-next-line react/exhaustive-deps
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
    for (const e of group.elections) {
      m.set(e.id, e);
    }
    return m;
  }, [group.elections]);

  const memberUserIds = useMemo(() => new Set(group.members.map((m) => m.userId)), [group.members]);

  // ── Voter sync from non-anonymous linked elections ─────────────────────────
  const linkedNonAnonElectionIds: string[] = (() => {
    const ids = new Set<string>();
    for (const item of agenda) {
      if (!item.electionId) {
        continue;
      }
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
    if (!canEdit) {
      return;
    }
    const toFetch = linkedNonAnonElectionIds.filter((id) => !voterCache.has(id));
    if (toFetch.length === 0) {
      return;
    }
    let cancelled = false;
    Promise.all(toFetch.map((id) => api.elections.getVoters(id).then((res) => ({ id, res })))).then(
      (results) => {
        if (cancelled) {
          return;
        }
        setVoterCache((prev) => {
          const next = new Map(prev);
          for (const { id, res } of results) {
            if (res.success) {
              next.set(id, res.data.voters);
            } else {
              next.set(id, []);
            }
          }
          return next;
        });
      },
    );
    return () => {
      cancelled = true;
    };
    // oxlint-disable-next-line react/exhaustive-deps
  }, [linkedNonAnonElectionIdsKey, canEdit]);

  const voterInfoByUserId = useMemo(() => {
    const map = new Map<string, { userId: string; fullName: string }>();
    for (const electionId of linkedNonAnonElectionIds) {
      const voters = voterCache.get(electionId);
      if (!voters) {
        continue;
      }
      for (const v of voters) {
        if (!map.has(v.userId)) {
          map.set(v.userId, v);
        }
      }
    }
    return map;
  }, [linkedNonAnonElectionIds, voterCache]);

  const lockedUserIds = useMemo(() => new Set(voterInfoByUserId.keys()), [voterInfoByUserId]);

  // Sync attendees with the decrypted voter set: force voters to present and
  // append rows for voters who aren't current group members.  Gender-aware
  // present text is derived from the voter's full name.
  useEffect(() => {
    const current = getValues('attendees');
    const existing = new Set(current.map((attendee) => attendee.userId));
    current.forEach((attendee, index) => {
      if (attendee.userId && voterInfoByUserId.has(attendee.userId) && !attendee.isPresent) {
        setValue(`attendees.${index}.isPresent`, true);
        setValue(`attendees.${index}.present_text`, getGenderedPresentText(attendee.fullname));
      }
    });
    const additions: AttendeeDraft[] = [];
    for (const [userId, info] of voterInfoByUserId) {
      if (!existing.has(userId)) {
        additions.push({
          uid: uid(),
          userId,
          fullname: info.fullName,
          posada: '',
          present_text: getGenderedPresentText(info.fullName),
          isPresent: true,
        });
      }
    }
    if (additions.length > 0) {
      appendAttendees(additions, { shouldFocus: false });
      setAttendeesSortKey(null);
    }
  }, [voterInfoByUserId, getValues, setValue, appendAttendees]);

  let presentCount = 0;
  for (const a of attendees) {
    if (a.isPresent) {
      presentCount++;
    }
  }

  const updateAgenda = (idx: number, patch: Partial<AgendaDraft>) => {
    setValue(
      `agenda.${idx}`,
      { ...getValues(`agenda.${idx}`), ...patch },
      { shouldDirty: true, shouldValidate: isSubmitted },
    );
  };
  const addAgenda = () => {
    if (agenda.length < PROTOCOL_MAX_AGENDA_ITEMS) {
      agendaFields.append(emptyAgenda());
    }
  };
  const removeAgenda = (idx: number) => {
    if (agenda.length > 1) {
      agendaFields.remove(idx);
    }
  };
  const moveAgenda = (idx: number, dir: -1 | 1) => {
    agendaFields.move(idx, idx + dir);
  };

  const setElectionForAgenda = (idx: number, electionId: string | null) => {
    if (!electionId) {
      updateAgenda(idx, { electionId: null, choiceMapping: {} });
      return;
    }
    const e = electionsById.get(electionId);
    if (!e) {
      return;
    }
    const sorted = [...e.choices].sort((a, b) => a.position - b.position);
    const mapping: ProtocolChoiceMapping = {};
    const order: AgendaChoiceVote[] = ['yes', 'no', 'abstain'];
    sorted.forEach((c, j) => {
      mapping[c.id] = order[j] ?? 'abstain';
    });
    updateAgenda(idx, { electionId, choiceMapping: mapping });
  };

  const setChoiceVote = (idx: number, choiceId: string, vote: AgendaChoiceVote) => {
    const current = getValues(`agenda.${idx}.choiceMapping`);
    setValue(
      `agenda.${idx}.choiceMapping`,
      { ...current, [choiceId]: vote },
      { shouldDirty: true, shouldValidate: isSubmitted },
    );
  };
  const addResponsible = () => {
    if (responsibles.length < PROTOCOL_MAX_RESPONSIBLES) {
      responsibleFields.append({ posada: '', fullname: '' });
      setResponsiblesSortKey(null);
    }
  };
  const removeResponsible = (idx: number) => {
    if (responsibles.length > 1) {
      responsibleFields.remove(idx);
    }
  };
  const moveResponsible = (idx: number, dir: -1 | 1) => {
    responsibleFields.move(idx, idx + dir);
    setResponsiblesSortKey(null);
  };
  const sortResponsibles = (key: QuickSortKey) => {
    responsibleFields.replace([...getValues('responsibles')].sort(compareByQuickSortKey(key)));
    setResponsiblesSortKey(key);
  };
  const updateAttendee = (idx: number, patch: Partial<AttendeeDraft>) => {
    const current = getValues(`attendees.${idx}`);
    const merged = { ...current, ...patch };
    if ('fullname' in patch) {
      merged.present_text = rederivePresenceText(merged.present_text, merged.fullname);
    }
    setValue(`attendees.${idx}`, merged, { shouldDirty: true, shouldValidate: isSubmitted });
    if ('posada' in patch || 'fullname' in patch) {
      setAttendeesSortKey(null);
    }
  };
  const togglePresence = (idx: number, present: boolean) => {
    const current = getValues(`attendees.${idx}`);
    if (current.userId && lockedUserIds.has(current.userId)) {
      return;
    }
    updateAttendee(idx, {
      isPresent: present,
      present_text: present
        ? getGenderedPresentText(current.fullname)
        : getGenderedAbsentText(current.fullname),
    });
  };
  const addManualAttendee = () => {
    if (attendees.length < PROTOCOL_MAX_ATTENDEES) {
      attendeeFields.append({
        uid: uid(),
        userId: null,
        fullname: '',
        posada: '',
        present_text: PRESENT_TEXT_MALE,
        isPresent: true,
      });
      setAttendeesSortKey(null);
    }
  };
  const removeAttendee = (idx: number) => {
    attendeeFields.remove(idx);
  };
  const moveAttendee = (idx: number, dir: -1 | 1) => {
    attendeeFields.move(idx, idx + dir);
    setAttendeesSortKey(null);
  };
  const sortAttendees = (key: QuickSortKey) => {
    attendeeFields.replace([...getValues('attendees')].sort(compareByQuickSortKey(key)));
    setAttendeesSortKey(key);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = submitForm(
    async (values) => {
      if (!canEdit) {
        return;
      }
      clearErrors('root');
      const payload = serializeProtocolForm(values);

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
    },
    (validationErrors) => {
      const firstMessage = (value: unknown): string | null => {
        if (!value || typeof value !== 'object') {
          return null;
        }
        if ('message' in value && typeof value.message === 'string') {
          return value.message;
        }
        for (const [key, child] of Object.entries(value)) {
          if (key === 'ref') {
            continue;
          }
          const message = firstMessage(child);
          if (message) {
            return message;
          }
        }
        return null;
      };
      showError(firstMessage(validationErrors) ?? 'Виправте помилки у формі');
    },
  );

  const handleGenerate = async () => {
    if (!initialProtocol) {
      return;
    }
    setGenerating(true);
    clearErrors('root');
    try {
      const response = await fetch(`/api/protocols/${initialProtocol.id}/generate`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        let message = `Помилка генерації (${response.status})`;
        try {
          const body = await response.json();
          if (body && typeof body.message === 'string') {
            message = body.message;
          }
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
            <Alert variant="error" onDismiss={() => clearErrors('root')}>
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
              <FormField
                label="Назва"
                required
                htmlFor="protocol-name"
                error={errors.name?.message}
                className="sm:col-span-2"
              >
                <Input
                  id="protocol-name"
                  {...register('name')}
                  maxLength={PROTOCOL_NAME_MAX_LENGTH}
                  placeholder="Наприклад: Засідання правління"
                  disabled={!canEdit}
                />
              </FormField>
              <FormField label="Дата" required htmlFor="protocol-date" error={errors.date?.message}>
                <Input id="protocol-date" type="date" {...register('date')} disabled={!canEdit} />
              </FormField>
              <FormField
                label="Номер"
                required
                htmlFor="protocol-number"
                error={errors.number?.message}
              >
                <Input
                  id="protocol-number"
                  type="number"
                  min={1}
                  {...register('number', {
                    onChange: () => {
                      numberManuallyEdited.current = true;
                    },
                  })}
                  placeholder="Наступний номер для року"
                  disabled={!canEdit}
                />
              </FormField>
              <FormField
                label="Запрошених гостей (необов'язково)"
                htmlFor="protocol-visitors"
                error={errors.visitors?.message}
                className="sm:col-span-2"
              >
                <Input
                  id="protocol-visitors"
                  type="number"
                  min={0}
                  max={PROTOCOL_MAX_VISITORS}
                  {...register('visitors')}
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
                value={group.memberCount}
              />
              <CountTile
                icon={<Users className="h-4 w-4" />}
                label="Кворум (2/3)"
                value={Math.ceil((group.memberCount * 2) / 3)}
              />
              <CountTile
                icon={<Vote className="h-4 w-4" />}
                label="Присутні"
                value={presentCount}
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
              {agendaRows.map((item, idx) => (
                <AgendaItemEditor
                  key={item.id}
                  index={idx}
                  total={agenda.length}
                  item={item}
                  linkableElections={linkableElections}
                  electionsById={electionsById}
                  canEdit={canEdit}
                  control={control}
                  register={register}
                  errors={errors.agenda?.[idx]}
                  onRemove={() => removeAgenda(idx)}
                  onMove={(dir) => moveAgenda(idx, dir)}
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
              {responsibleRows.map((r, idx) => (
                <div
                  key={r.id}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center"
                >
                  <Input
                    {...register(`responsibles.${idx}.posada`, {
                      onChange: () => setResponsiblesSortKey(null),
                    })}
                    error={!!errors.responsibles?.[idx]?.posada}
                    placeholder="Посада (наприклад: Голова)"
                    maxLength={PROTOCOL_RESPONSIBLE_POSADA_MAX_LENGTH}
                    disabled={!canEdit}
                  />
                  <Input
                    {...register(`responsibles.${idx}.fullname`, {
                      onChange: () => setResponsiblesSortKey(null),
                    })}
                    error={!!errors.responsibles?.[idx]?.fullname}
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
              <p className="font-body py-4 text-center text-sm text-muted-foreground">
                Учасників ще немає
              </p>
            ) : (
              <div className="space-y-2">
                {attendeeRows.map((a, idx) => {
                  const isLockedByVote = a.userId !== null && lockedUserIds.has(a.userId);
                  const isMember = a.userId !== null && memberUserIds.has(a.userId);
                  const canDelete = canEdit && !isLockedByVote && !isMember;
                  return (
                    <div
                      key={a.id}
                      className={cn(
                        'rounded-md border border-border-subtle p-3',
                        a.isPresent ? 'bg-success-bg/20' : 'bg-surface',
                      )}
                    >
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center">
                        <Input
                          error={!!errors.attendees?.[idx]?.fullname}
                          value={a.fullname}
                          onChange={(e) => updateAttendee(idx, { fullname: e.target.value })}
                          placeholder="ПІБ"
                          maxLength={PROTOCOL_RESPONSIBLE_FULLNAME_MAX_LENGTH}
                          disabled={!canEdit}
                        />
                        <Input
                          error={!!errors.attendees?.[idx]?.posada}
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
                            <span className="w-9" />
                          )}
                        </div>
                      </div>
                      {(errors.attendees?.[idx]?.fullname ||
                        errors.attendees?.[idx]?.posada ||
                        errors.attendees?.[idx]?.present_text) && (
                        <p className="mt-1 text-xs text-error">
                          {errors.attendees?.[idx]?.fullname?.message ||
                            errors.attendees?.[idx]?.posada?.message ||
                            errors.attendees?.[idx]?.present_text?.message}
                        </p>
                      )}
                      {isLockedByVote && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs text-success">
                          <Lock className="h-3 w-3 shrink-0" />
                          Підтверджено голосуванням — присутність не можна змінити
                          {!isMember && ' (не входить до групи)'}
                        </p>
                      )}
                      {!isLockedByVote && a.userId === null && (
                        <p className="mt-1.5 text-xs text-muted-foreground">Ручний рядок</p>
                      )}
                      {!isLockedByVote && a.userId !== null && !isMember && (
                        <p className="mt-1.5 text-xs text-muted-foreground">
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
              <Link href={`/groups/${group.id}`}>Назад</Link>
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
    <div className="border-border-color rounded-xl border bg-card shadow-card">
      <div className="flex items-center justify-between gap-4 border-b border-border-subtle px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="font-body mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
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
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
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
      {icon && <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>}
      <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="font-body wrap-break-word text-foreground">{value}</span>
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
    <div className="space-y-1 rounded-lg border border-border-subtle bg-surface p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="font-display text-2xl font-semibold text-foreground">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
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
  control: Control<ProtocolFormValues>;
  register: UseFormRegister<ProtocolFormValues>;
  errors?: FieldErrors<ProtocolFormValues['agenda'][number]>;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
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
  control,
  register,
  errors,
  onRemove,
  onMove,
  onSelectElection,
  onSetChoiceVote,
}: AgendaItemEditorProps) {
  const listeners = useFieldArray({ control, name: `agenda.${index}.listeners` });
  const linkedElection = item.electionId ? (electionsById.get(item.electionId) ?? null) : null;
  const sortedChoices = (() => {
    if (!linkedElection) {
      return [];
    }
    return [...linkedElection.choices].sort((a, b) => a.position - b.position);
  })();

  return (
    <div className="border-border-color rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-kpi-navy/10 text-xs font-semibold text-kpi-navy">
            {index + 1}
          </span>
          <p className="font-body text-sm font-semibold text-foreground">Пункт {index + 1}</p>
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
        <FormField label="Назва пункту" required error={errors?.name?.message}>
          <Input
            {...register(`agenda.${index}.name`)}
            maxLength={PROTOCOL_AGENDA_ITEM_NAME_MAX_LENGTH}
            placeholder="Про затвердження..."
            disabled={!canEdit}
          />
        </FormField>

        <FormField label="Слухали">
          <div className="space-y-2">
            {listeners.fields.map((listener, lIdx) => (
              <div key={listener.id} className="rounded-md border border-border-subtle p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Слухач #{lIdx + 1}</span>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => listeners.remove(lIdx)}
                      disabled={item.listeners.length <= 1}
                      className="text-error hover:bg-error-bg"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <Input
                  className="mb-2"
                  {...register(`agenda.${index}.listeners.${lIdx}.fullname`)}
                  error={!!errors?.listeners?.[lIdx]?.fullname}
                  placeholder="ПІБ"
                  maxLength={PROTOCOL_LISTENER_FULLNAME_MAX_LENGTH}
                  disabled={!canEdit}
                />
                <Textarea
                  rows={3}
                  {...register(`agenda.${index}.listeners.${lIdx}.speech`)}
                  error={!!errors?.listeners?.[lIdx]?.speech}
                  placeholder="Зміст виступу"
                  maxLength={PROTOCOL_LISTENER_SPEECH_MAX_LENGTH}
                  disabled={!canEdit}
                />
                {(errors?.listeners?.[lIdx]?.fullname || errors?.listeners?.[lIdx]?.speech) && (
                  <p className="mt-1 text-xs text-error">
                    {errors?.listeners?.[lIdx]?.fullname?.message ||
                      errors?.listeners?.[lIdx]?.speech?.message}
                  </p>
                )}
              </div>
            ))}
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => listeners.append({ fullname: '', speech: '' })}
                disabled={item.listeners.length >= PROTOCOL_MAX_LISTENERS_PER_ITEM}
              >
                <Plus className="h-3.5 w-3.5" />
                Додати слухача
              </Button>
            )}
          </div>
        </FormField>

        <FormField label="Постановили (необовʼязково)" error={errors?.result?.message}>
          <Textarea
            rows={3}
            {...register(`agenda.${index}.result`)}
            maxLength={PROTOCOL_AGENDA_ITEM_RESULT_MAX_LENGTH}
            placeholder="Текст постанови"
            disabled={!canEdit}
          />
        </FormField>

        <FormField
          label="Привʼязане голосування"
          error={
            errors?.electionId?.message ||
            (typeof errors?.choiceMapping?.message === 'string'
              ? errors.choiceMapping.message
              : undefined)
          }
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
          <div className="rounded-md border border-border-subtle bg-surface p-3">
            <p className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Мапінг варіантів — За / Проти / Утримались
            </p>
            <div className="space-y-2">
              {sortedChoices.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{c.choice}</p>
                    <p className="text-xs text-muted-foreground">Голосів: {c.votes ?? 0}</p>
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
                            ? 'border-kpi-navy bg-kpi-navy text-white'
                            : 'border-border-color bg-card text-foreground hover:border-kpi-blue-light',
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
