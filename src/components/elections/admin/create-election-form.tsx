'use client';

import { Lock, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { WinningConditionsSection } from '@/components/elections/admin/winning-conditions-section';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CharCounter } from '@/components/ui/char-counter';
import { ChipSelect } from '@/components/ui/chip-select';
import { FormField, Input, Textarea } from '@/components/ui/form';
import { KyivDateTimePicker } from '@/components/ui/kyiv-date-time-picker';
import { MultiCombobox } from '@/components/ui/multi-combobox';
import { Slider } from '@/components/ui/slider';
import { ToggleField } from '@/components/ui/toggle-field';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import {
  ELECTION_CHOICE_MAX_LENGTH,
  ELECTION_CHOICES_MAX,
  ELECTION_CHOICES_MIN,
  ELECTION_DESCRIPTION_MAX_LENGTH,
  ELECTION_MAX_CHOICES_MAX,
  ELECTION_MAX_CLOSES_AT_DAYS,
  ELECTION_MIN_CHOICES_MIN,
  ELECTION_TITLE_MAX_LENGTH,
  LEVEL_COURSE_BACHELOR_COURSES,
  LEVEL_COURSE_MASTER_COURSES,
  STUDY_FORM_LABELS,
  UI_STUDY_FORMS,
  WINNING_CONDITION_PERCENTAGE_MAX_EXCLUSIVE,
  WINNING_CONDITION_PERCENTAGE_MIN,
  WINNING_CONDITION_QUORUM_MAX,
  WINNING_CONDITION_QUORUM_MIN,
  WINNING_CONDITION_VOTES_MAX,
  WINNING_CONDITION_VOTES_MIN,
} from '@/lib/constants';
import { cn, pluralize } from '@/lib/utils/common';
import {
  filterGroupsByLevelCourses,
  filterGroupsByStudyForms,
  parseGroupLevel,
} from '@/lib/utils/group-utils';
import type {
  CreateElectionRestriction,
  WinningConditions,
  WinningConditionsState,
} from '@/types/election';
import type { AdminGroupSummary, GroupOption } from '@/types/group';

interface CreateElectionFormProps {
  restrictedToFaculty: string | null;
  manageGroups: boolean;
}

// Graduate level ('g') is intentionally excluded — graduate students cannot
// participate in elections on this platform.
const LEVEL_COLUMNS = [
  { key: 'b', label: 'Бакалаври', courses: LEVEL_COURSE_BACHELOR_COURSES },
  { key: 'm', label: 'Магістри', courses: LEVEL_COURSE_MASTER_COURSES },
] as const;

const DEFAULT_WC_STATE: WinningConditionsState = {
  hasMostVotes: true,
  reachesPercentageEnabled: false,
  reachesPercentage: 50,
  reachesVotesEnabled: false,
  reachesVotes: 10,
  quorumEnabled: false,
  quorum: 100,
};

function wcStateToPayload(wc: WinningConditionsState, choicesCount: number): WinningConditions {
  if (choicesCount === 1) {
    return {
      hasMostVotes: false,
      reachesPercentage: null,
      reachesVotes: null,
      quorum: wc.quorumEnabled ? wc.quorum : null,
    };
  }

  return {
    hasMostVotes: wc.hasMostVotes,
    reachesPercentage: wc.reachesPercentageEnabled ? wc.reachesPercentage : null,
    reachesVotes: wc.reachesVotesEnabled ? wc.reachesVotes : null,
    quorum: wc.quorumEnabled ? wc.quorum : null,
  };
}

export function CreateElectionForm({
  restrictedToFaculty = null,
  manageGroups,
}: CreateElectionFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Campus faculty/group data
  const [facultyGroups, setFacultyGroups] = useState<Record<string, string[]>>({});
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState<string | null>(null);

  // Owned groups for GROUP_MEMBERSHIP restriction
  const [ownedGroups, setOwnedGroups] = useState<GroupOption[] | AdminGroupSummary[]>([]);
  const [ownedGroupsLoading, setOwnedGroupsLoading] = useState(true);

  useEffect(() => {
    const fetchGroups = async () => {
      const [campusRes, ownedRes] = await Promise.all([
        api.campus.getGroups(),
        manageGroups ? api.groups.all() : api.groups.owned(),
      ]);

      if (!campusRes.success) {
        setGroupsError('Не вдалося завантажити список підрозділів і груп');
      } else {
        setFacultyGroups(campusRes.data);
      }
      setGroupsLoading(false);

      if (ownedRes.success) {
        setOwnedGroups(ownedRes.data);
      }
      setOwnedGroupsLoading(false);
    };

    fetchGroups();
  }, [manageGroups]);

  const facultyOptions = Object.keys(facultyGroups).sort((a, b) => {
    const aNN = a.startsWith('НН ');
    const bNN = b.startsWith('НН ');
    if (aNN !== bNN) return aNN ? 1 : -1;
    return a.localeCompare(b, 'uk');
  });

  // Form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    opensAt: '',
    closesAt: '',
    minChoices: 1,
    maxChoices: 1,
  });

  const [winningConditionsState, setWinningConditionsState] =
    useState<WinningConditionsState>(DEFAULT_WC_STATE);

  // Restriction state
  const [selectedFaculties, setSelectedFaculties] = useState<string[]>(
    restrictedToFaculty ? [restrictedToFaculty] : [],
  );
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedForms, setSelectedForms] = useState<string[]>([]);
  const [selectedLevelCourses, setSelectedLevelCourses] = useState<string[]>([]);
  const [selectedGroupMemberships, setSelectedGroupMemberships] = useState<string[]>([]);
  const [bypassRequired, setBypassRequired] = useState(false);

  // When the admin is faculty-restricted but has ≥1 GROUP_MEMBERSHIP restriction,
  // they may opt out of the automatic faculty restriction.
  const canBypassFaculty = !!restrictedToFaculty && selectedGroupMemberships.length > 0;
  const [includeFacultyRestriction, setIncludeFacultyRestriction] = useState(true);

  useEffect(() => {
    // If the bypass condition is no longer met, re-enable the faculty restriction.
    if (!canBypassFaculty) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIncludeFacultyRestriction(true);
    }
  }, [canBypassFaculty]);

  // Election options
  const [shuffleChoices, setShuffleChoices] = useState(false);
  const [publicViewing, setPublicViewing] = useState(false);
  /**
   * Privacy: when `true` (default) voter identities are never stored in
   * ballots.  When `false` (non-anonymous), every ballot v2 envelope will
   * embed the voter's userId and fullName; this information is revealed when
   * the election closes and the RSA private key is published.
   */
  const [anonymous, setAnonymous] = useState(true);

  const [choices, setChoices] = useState(['', '']);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Available campus groups filtered by faculties + form + level
  const availableGroups = useMemo(() => {
    let groups = Array.from(new Set(selectedFaculties.flatMap((f) => facultyGroups[f] ?? []))).sort(
      (a, b) => a.localeCompare(b, 'uk'),
    );
    groups = groups.filter((g) => parseGroupLevel(g) !== 'g');
    if (selectedForms.length > 0) {
      groups = filterGroupsByStudyForms(groups, selectedForms);
    }
    if (selectedLevelCourses.length > 0) {
      groups = filterGroupsByLevelCourses(groups, selectedLevelCourses);
    }
    return groups;
  }, [selectedFaculties, facultyGroups, selectedForms, selectedLevelCourses]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedGroups((prev) => prev.filter((g) => availableGroups.includes(g)));
  }, [availableGroups]);

  useEffect(() => {
    if (choices.length <= 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShuffleChoices(false);
    }
  }, [choices.length]);

  const noGroupsMatchCriteria =
    selectedFaculties.length > 0 &&
    availableGroups.length === 0 &&
    (selectedForms.length > 0 || selectedLevelCourses.length > 0) &&
    !groupsLoading;

  const restrictions: CreateElectionRestriction[] = [
    ...(restrictedToFaculty && !includeFacultyRestriction
      ? []
      : selectedFaculties.map((v) => ({ type: 'FACULTY' as const, value: v }))),
    ...selectedGroups.map((v) => ({ type: 'GROUP' as const, value: v })),
    ...selectedForms.map((v) => ({ type: 'STUDY_FORM' as const, value: v })),
    ...selectedLevelCourses.map((v) => ({ type: 'LEVEL_COURSE' as const, value: v })),
    ...selectedGroupMemberships.map((v) => ({ type: 'GROUP_MEMBERSHIP' as const, value: v })),
    ...(bypassRequired ? [{ type: 'BYPASS_REQUIRED' as const, value: 'true' }] : []),
  ];

  function handleFacultiesChange(faculties: string[]) {
    if (restrictedToFaculty) return;
    setSelectedFaculties(faculties);
    setFieldErrors((p) => ({ ...p, faculties: '' }));
    setError(null);
  }

  const updateForm = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    setError(null);
  };

  const updateChoice = (index: number, value: string) => {
    setChoices((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setFieldErrors((prev) => ({ ...prev, [`choice_${index}`]: '' }));
    setError(null);
  };

  const addChoice = () => {
    if (choices.length < ELECTION_CHOICES_MAX) setChoices((p) => [...p, '']);
  };

  const removeChoice = (index: number) => {
    if (choices.length > ELECTION_CHOICES_MIN) setChoices((p) => p.filter((_, i) => i !== index));
  };

  const toggleLevelCourse = (value: string) => {
    setSelectedLevelCourses((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
    setFieldErrors((prev) => ({ ...prev, levelCourses: '' }));
    setError(null);
  };

  function validateWinningConditionsUI(): boolean {
    const errors: Record<string, string> = {};
    const wc = winningConditionsState;

    if (choices.length > 1) {
      if (
        !wc.hasMostVotes &&
        !wc.reachesPercentageEnabled &&
        !wc.reachesVotesEnabled &&
        !wc.quorumEnabled
      ) {
        errors.winningConditions = 'Виберіть принаймні одну умову перемоги';
      }

      if (wc.reachesPercentageEnabled) {
        if (
          isNaN(wc.reachesPercentage) ||
          wc.reachesPercentage < WINNING_CONDITION_PERCENTAGE_MIN ||
          wc.reachesPercentage >= WINNING_CONDITION_PERCENTAGE_MAX_EXCLUSIVE
        ) {
          errors.reachesPercentage = `Значення повинно бути від ${WINNING_CONDITION_PERCENTAGE_MIN} до менш ніж ${WINNING_CONDITION_PERCENTAGE_MAX_EXCLUSIVE}`;
        }
      }

      if (wc.reachesVotesEnabled) {
        if (
          !Number.isInteger(wc.reachesVotes) ||
          wc.reachesVotes < WINNING_CONDITION_VOTES_MIN ||
          wc.reachesVotes > WINNING_CONDITION_VOTES_MAX
        ) {
          errors.reachesVotes = `Ціле число від ${WINNING_CONDITION_VOTES_MIN} до ${WINNING_CONDITION_VOTES_MAX}`;
        }
      }
    } else if (!wc.quorumEnabled) {
      errors.quorum = 'Має бути задано для опитувань з 1 варіантом голосу';
    }

    if (wc.quorumEnabled) {
      if (
        !Number.isInteger(wc.quorum) ||
        wc.quorum < WINNING_CONDITION_QUORUM_MIN ||
        wc.quorum > WINNING_CONDITION_QUORUM_MAX
      ) {
        errors.quorum = `Ціле число від ${WINNING_CONDITION_QUORUM_MIN} до ${WINNING_CONDITION_QUORUM_MAX}`;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errors }));
      return false;
    }

    return true;
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.title.trim()) errors.title = "Назва обов'язкова";
    else if (form.title.length > ELECTION_TITLE_MAX_LENGTH)
      errors.title = `Назва не може перевищувати ${ELECTION_TITLE_MAX_LENGTH} символів`;

    if (form.description.length > ELECTION_DESCRIPTION_MAX_LENGTH)
      errors.description = `Опис не може перевищувати ${ELECTION_DESCRIPTION_MAX_LENGTH} символів`;

    if (!form.opensAt) errors.opensAt = "Дата початку обов'язкова";
    if (!form.closesAt) errors.closesAt = "Дата завершення обов'язкова";

    const openDate = new Date(form.opensAt),
      closeDate = new Date(form.closesAt);
    if (form.opensAt && form.closesAt && closeDate <= openDate)
      errors.closesAt = 'Дата завершення має бути після дати початку';

    choices.forEach((choice, i) => {
      if (!choice.trim()) errors[`choice_${i}`] = 'Варіант не може бути порожнім';
      else if (choice.length > ELECTION_CHOICE_MAX_LENGTH)
        errors[`choice_${i}`] =
          `Варіант не може перевищувати ${ELECTION_CHOICE_MAX_LENGTH} символів`;
    });

    if (new Set(choices.map((c) => c.trim().toLowerCase())).size !== choices.length)
      errors.choices = 'Варіанти не можуть повторюватися';

    if (noGroupsMatchCriteria) {
      errors.levelCourses =
        'Жодна група не відповідає вибраним обмеженням. Змініть критерії або приберіть деякі фільтри.';
    }

    if (selectedFaculties.length > 0 && selectedGroups.length > 0 && !groupsLoading) {
      const redundantFaculties = selectedFaculties.filter((faculty) => {
        const groupsInFaculty = facultyGroups[faculty] || [];
        return !selectedGroups.some((g) => groupsInFaculty.includes(g));
      });

      if (redundantFaculties.length > 0) {
        errors.faculties = `Зайві підрозділи (не містять обраних груп): ${redundantFaculties.join(', ')}`;
      }
    }

    setFieldErrors(errors);
    const baseValid = Object.keys(errors).length === 0;
    const wcValid = validateWinningConditionsUI();
    return baseValid && wcValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      setError('Будь ласка, виправте підсвічені помилки валідації');
      return;
    }
    setLoading(true);
    setError(null);

    const filteredChoices = choices.filter((c) => c.trim());
    const trimmedDescription = form.description.trim();
    const result = await api.elections.create({
      title: form.title.trim(),
      description: trimmedDescription ? trimmedDescription : null,
      opensAt: new Date(form.opensAt).toISOString(),
      closesAt: new Date(form.closesAt).toISOString(),
      choices: filteredChoices,
      minChoices: Math.min(form.minChoices, filteredChoices.length),
      maxChoices: Math.min(form.maxChoices, filteredChoices.length),
      restrictions,
      winningConditions: wcStateToPayload(winningConditionsState, filteredChoices.length),
      shuffleChoices,
      publicViewing: restrictions.length === 0 || publicViewing,
      anonymous,
    });

    if (result.success) {
      toast({
        title: 'Голосування створено!',
        description: `"${form.title}" успішно опубліковано.`,
        variant: 'success',
        duration: 6000,
      });
      router.push(`/admin/elections/${result.data.id}`);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const [renderTime] = useState(() => Date.now());
  const minDateTime = new Date(renderTime + 60 * 1000).toISOString().slice(0, 16);
  const maxOpensAt = new Date(
    renderTime + ELECTION_MAX_CLOSES_AT_DAYS * 24 * 60 * 60 * 1000 - 60 * 1000,
  )
    .toISOString()
    .slice(0, 16);
  const maxClosesAt = new Date(renderTime + ELECTION_MAX_CLOSES_AT_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  const studyFormOptions = UI_STUDY_FORMS.map((f) => ({
    value: f,
    label: STUDY_FORM_LABELS[f],
  }));

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* ── Basic info ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="font-display text-foreground mb-4 text-xl font-semibold">
          Основна інформація
        </h2>
        <div className="space-y-5">
          <FormField label="Назва" required error={fieldErrors.title} htmlFor="title">
            <div className="space-y-1">
              <Input
                id="title"
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
                placeholder="Введіть назву голосування"
                error={!!fieldErrors.title || form.title.length > ELECTION_TITLE_MAX_LENGTH}
              />
              <div className="flex justify-end">
                <CharCounter value={form.title} max={ELECTION_TITLE_MAX_LENGTH} />
              </div>
            </div>
          </FormField>

          <FormField
            label="Опис голосування"
            error={fieldErrors.description}
            htmlFor="description"
            hint="Необов'язково"
          >
            <div className="space-y-1">
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder="Коротко опишіть мету голосування, контекст і деталі"
                rows={4}
                maxLength={ELECTION_DESCRIPTION_MAX_LENGTH}
                error={
                  !!fieldErrors.description ||
                  form.description.length > ELECTION_DESCRIPTION_MAX_LENGTH
                }
              />
              <div className="flex justify-end">
                <CharCounter value={form.description} max={ELECTION_DESCRIPTION_MAX_LENGTH} />
              </div>
            </div>
          </FormField>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField label="Початок" required error={fieldErrors.opensAt} htmlFor="opensAt">
              <KyivDateTimePicker
                id="opensAt"
                value={form.opensAt}
                onChange={(date) => updateForm('opensAt', date.toISOString())}
                min={minDateTime}
                max={maxOpensAt}
                error={!!fieldErrors.opensAt}
              />
            </FormField>
            <FormField label="Завершення" required error={fieldErrors.closesAt} htmlFor="closesAt">
              <KyivDateTimePicker
                id="closesAt"
                value={form.closesAt}
                onChange={(date) => updateForm('closesAt', date.toISOString())}
                min={form.opensAt || minDateTime}
                max={maxClosesAt}
                error={!!fieldErrors.closesAt}
              />
            </FormField>
          </div>
        </div>
      </section>

      {/* ── Choices ────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="font-display text-foreground mb-1 text-xl font-semibold">
          Варіанти відповідей
        </h2>
        <p className="font-body text-muted-foreground mb-4 text-sm">
          Додайте від {ELECTION_CHOICES_MIN} до {ELECTION_CHOICES_MAX} варіантів
        </p>
        {fieldErrors.choices && (
          <Alert variant="error" className="mb-3">
            {fieldErrors.choices}
          </Alert>
        )}

        <div className="space-y-3">
          {choices.map((choice, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="flex-1 space-y-1">
                <Input
                  value={choice}
                  onChange={(e) => updateChoice(index, e.target.value)}
                  placeholder={`Варіант ${index + 1}`}
                  error={
                    !!fieldErrors[`choice_${index}`] || choice.length > ELECTION_CHOICE_MAX_LENGTH
                  }
                />
                <div className="flex items-center justify-between">
                  {fieldErrors[`choice_${index}`] ? (
                    <p className="text-error text-xs">{fieldErrors[`choice_${index}`]}</p>
                  ) : (
                    <span />
                  )}
                  <CharCounter value={choice} max={ELECTION_CHOICE_MAX_LENGTH} />
                </div>
              </div>
              {choices.length > ELECTION_CHOICES_MIN && (
                <button
                  type="button"
                  onClick={() => removeChoice(index)}
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-(--radius)',
                    'text-muted-foreground hover:bg-error-bg hover:text-error transition-colors duration-150',
                  )}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {choices.length < ELECTION_CHOICES_MAX && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={addChoice}
            icon={<Plus className="h-4 w-4" />}
          >
            Додати варіант
          </Button>
        )}

        {choices.length > 1 && (
          <ToggleField
            label="Перемішувати варіанти"
            description="У кожного користувача буде свій випадковий порядок відображення варіантів"
            checked={shuffleChoices}
            onChange={setShuffleChoices}
            className="mt-6"
          />
        )}

        {/* Min/Max choices */}
        {choices.length > 1 && (
          <div className="mt-6">
            <FormField
              label="Дозволено обирати варіантів"
              required
              error={fieldErrors.minChoices || fieldErrors.maxChoices}
              htmlFor="choices-slider"
            >
              <Slider
                id="choices-slider"
                min={ELECTION_MIN_CHOICES_MIN}
                max={Math.max(
                  ELECTION_MIN_CHOICES_MIN,
                  Math.min(ELECTION_MAX_CHOICES_MAX, Math.max(choices.length, 2)),
                )}
                step={1}
                value={[form.minChoices, form.maxChoices]}
                onValueChange={([newMin, newMax]) => {
                  setForm((prev) => ({ ...prev, minChoices: newMin, maxChoices: newMax }));
                  setFieldErrors((prev) => ({ ...prev, minChoices: '', maxChoices: '' }));
                  setError(null);
                }}
                className="my-5"
              />
              <div className="font-body flex items-center justify-between text-sm font-medium">
                <div className="flex flex-col items-start">
                  <span className="text-muted-foreground text-xs">Мінімум</span>
                  <span className="text-foreground">
                    {Math.min(form.minChoices, choices.length)}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-muted-foreground text-xs">Максимум</span>
                  <span className="text-foreground">
                    {Math.min(form.maxChoices, choices.length)}
                  </span>
                </div>
              </div>
            </FormField>
          </div>
        )}
      </section>

      {/* ── Winning conditions ──────────────────────────────────────────────── */}
      <section>
        <h2 className="font-display text-foreground mb-1 text-xl font-semibold">Умови перемоги</h2>
        <p className="font-body text-muted-foreground mb-4 text-sm">
          Визначте, за якими критеріями обирається переможець. Усі вибрані умови застосовуються
          одночасно.
        </p>
        <WinningConditionsSection
          state={winningConditionsState}
          validChoicesCount={choices.length}
          onChange={(next) => {
            setWinningConditionsState(next);
            setFieldErrors((prev) => ({
              ...prev,
              winningConditions: '',
              reachesPercentage: '',
              reachesVotes: '',
              quorum: '',
            }));
            setError(null);
          }}
          errors={fieldErrors}
        />
        {fieldErrors.winningConditions && (
          <p className="text-error mt-2 text-sm">{fieldErrors.winningConditions}</p>
        )}
      </section>

      {/* ── Access restrictions ─────────────────────────────────────────────── */}
      <section>
        <h2 className="font-display text-foreground mb-1 text-xl font-semibold">
          Обмеження доступу
        </h2>
        <p className="font-body text-muted-foreground mb-4 text-sm">
          Залиште порожнім для всіх студентів. Різні типи обмежень застосовуються через «І», кілька
          значень одного типу — через «АБО».
        </p>

        {groupsError && (
          <Alert variant="warning" className="mb-4">
            {groupsError}
          </Alert>
        )}

        <div className="space-y-5">
          {/* Faculty */}
          <FormField
            label="Підрозділ"
            htmlFor="faculties"
            hint={
              restrictedToFaculty
                ? canBypassFaculty
                  ? undefined
                  : 'Акаунт обмежений одним підрозділом'
                : undefined
            }
            error={fieldErrors.faculties}
          >
            {restrictedToFaculty ? (
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    value={restrictedToFaculty}
                    readOnly
                    className={cn(
                      'bg-surface pr-9',
                      !includeFacultyRestriction
                        ? 'cursor-not-allowed opacity-40'
                        : 'cursor-not-allowed',
                    )}
                  />
                  <div className="text-kpi-gray-mid pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
                    <Lock className="h-4 w-4" />
                  </div>
                </div>
                {canBypassFaculty && (
                  <ToggleField
                    label="Включити обмеження підрозділом"
                    description={
                      includeFacultyRestriction
                        ? 'Можна зняти обмеження підрозділу завдяки обмеженню за членством у групі'
                        : 'Обмеження підрозділу знято — діє обмеження за членством у групі'
                    }
                    checked={includeFacultyRestriction}
                    onChange={setIncludeFacultyRestriction}
                  />
                )}
              </div>
            ) : (
              <MultiCombobox
                id="faculties"
                options={groupsLoading ? [] : facultyOptions}
                value={selectedFaculties}
                onChange={handleFacultiesChange}
                placeholder={groupsLoading ? 'Завантаження…' : 'Без обмеження'}
                searchPlaceholder="Пошук підрозділу…"
                disabled={groupsLoading}
                emptyText="Підрозділ не знайдено"
              />
            )}
          </FormField>

          {/* Study form */}
          <FormField label="Форма навчання">
            <ChipSelect
              options={studyFormOptions}
              value={selectedForms}
              onChange={(forms) => {
                setSelectedForms(forms);
                setFieldErrors((prev) => ({ ...prev, levelCourses: '' }));
                setError(null);
              }}
            />
          </FormField>

          {/* Level & course */}
          <FormField label="Рівень та курс" error={fieldErrors.levelCourses}>
            <div className={`grid grid-cols-1 gap-4 sm:grid-cols-${LEVEL_COLUMNS.length}`}>
              {LEVEL_COLUMNS.map(({ key, label, courses }) => (
                <div key={key} className="space-y-2">
                  <p className="font-body text-foreground text-sm font-medium">{label}</p>
                  <div className="flex flex-wrap gap-2">
                    {courses.map((course) => {
                      const value = `${key}${course}`;
                      const isSelected = selectedLevelCourses.includes(value);
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => toggleLevelCourse(value)}
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-(--radius) border',
                            'font-body text-sm font-semibold transition-colors duration-150',
                            'focus-visible:ring-kpi-blue-light focus-visible:ring-2 focus-visible:outline-none',
                            isSelected
                              ? 'border-kpi-navy bg-kpi-navy shadow-shadow-sm text-white'
                              : 'border-border-color text-foreground hover:border-kpi-blue-light bg-white',
                          )}
                        >
                          {course}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {noGroupsMatchCriteria && !fieldErrors.levelCourses && (
              <p className="text-warning mt-2 text-sm">
                Жодна група з обраних підрозділів не відповідає цим критеріям.
              </p>
            )}
          </FormField>

          {/* Campus group */}
          <FormField
            label="Група"
            htmlFor="groups"
            hint={
              selectedFaculties.length === 0
                ? 'Спочатку оберіть підрозділ'
                : noGroupsMatchCriteria
                  ? 'Немає груп, що відповідають обраним критеріям'
                  : undefined
            }
          >
            <MultiCombobox
              id="groups"
              options={availableGroups}
              value={selectedGroups}
              onChange={(g) => {
                setSelectedGroups(g);
                setError(null);
              }}
              placeholder="Без обмеження"
              searchPlaceholder="Пошук групи…"
              disabled={selectedFaculties.length === 0 || groupsLoading || noGroupsMatchCriteria}
              emptyText="Групу не знайдено"
            />
          </FormField>

          {/* GROUP_MEMBERSHIP restriction */}
          {(ownedGroups.length > 0 || !ownedGroupsLoading) && (
            <FormField
              label="Членство в групі"
              htmlFor="group-memberships"
              hint={
                ownedGroupsLoading
                  ? 'Завантаження ваших груп…'
                  : ownedGroups.length === 0
                    ? 'У вас немає власних груп'
                    : 'Лише члени обраних груп зможуть взяти участь у голосуванні'
              }
            >
              {ownedGroupsLoading ? (
                <p className="font-body text-muted-foreground text-sm">Завантаження…</p>
              ) : ownedGroups.length === 0 ? (
                <p className="font-body text-muted-foreground text-sm italic">
                  Немає доступних груп
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {ownedGroups.map((grp) => {
                    const isSelected = selectedGroupMemberships.includes(grp.id);
                    return (
                      <button
                        key={grp.id}
                        type="button"
                        onClick={() => {
                          setSelectedGroupMemberships((prev) =>
                            isSelected ? prev.filter((id) => id !== grp.id) : [...prev, grp.id],
                          );
                          setError(null);
                        }}
                        className={cn(
                          'font-body min-w-0 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-all duration-150',
                          'focus-visible:ring-kpi-blue-light focus-visible:ring-2 focus-visible:outline-none',
                          isSelected
                            ? 'border-kpi-navy bg-kpi-navy shadow-shadow-sm text-white'
                            : 'border-border-color text-foreground hover:border-kpi-blue-light bg-white',
                        )}
                      >
                        <span className="block font-semibold wrap-break-word">{grp.name}</span>
                        <span
                          className={cn(
                            'mt-0.5 block text-xs',
                            isSelected ? 'text-white/70' : 'text-muted-foreground',
                          )}
                        >
                          {pluralize(grp.memberCount, ['учасник', 'учасники', 'учасників'])}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </FormField>
          )}

          <ToggleField
            label="Доступ лише за токеном"
            description="Участь зможуть взяти лише люди, яким видано токен доступу до голосування."
            checked={bypassRequired}
            onChange={setBypassRequired}
          />

          {restrictions.length > 0 && (
            <ToggleField
              label="Публічний перегляд"
              description="Будь-який авторизований користувач може переглядати сторінку голосування за посиланням. Однак у загальному списку вона не відображатиметься для користувачів, які не відповідають умовам участі."
              checked={publicViewing}
              onChange={setPublicViewing}
            />
          )}

          <ToggleField
            label="Анонімне голосування"
            description="Особи учасників криптографічно захищені й не можуть бути розкриті"
            checked={anonymous}
            onChange={setAnonymous}
          />

          {!anonymous && (
            <Alert variant="warning" title="Голосування не є анонімним">
              Після завершення голосування ПІБ та ідентифікатор кожного учасника будуть відображені
              поруч із їхнім зашифрованим бюлетенем. Ця інформація стане доступною для всіх, хто має
              право переглядати сторінку бюлетенів.
            </Alert>
          )}
        </div>
      </section>

      {/* ── Submit ──────────────────────────────────────────────────────────── */}
      <div className="border-border-subtle flex flex-col gap-3 border-t pt-4">
        {error && (
          <Alert variant="error" title="Помилка" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => router.back()}
            disabled={loading}
          >
            Скасувати
          </Button>
          <Button type="submit" variant="accent" size="lg" loading={loading}>
            Створити голосування
          </Button>
        </div>
      </div>
    </form>
  );
}
