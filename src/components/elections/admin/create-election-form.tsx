'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type FieldPath,
  type FieldPathValue,
} from 'react-hook-form';

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
} from '@/lib/constants';
import {
  createElectionFormSchema,
  getElectionCampusGroups,
  type ElectionFormValues,
} from '@/lib/schemas/election-form';
import { cn, pluralize } from '@/lib/utils/common';
import type {
  CreateElectionRestriction,
  ElectionDetail,
  WinningConditions,
  WinningConditionsState,
} from '@/types/election';
import type { AdminGroupSummary, GroupOption } from '@/types/group';

interface CreateElectionFormProps {
  restrictedToFaculty: string | null;
  manageGroups: boolean;
  initialGroupMembershipId?: string | null;
  /** When provided, the form runs in edit mode */
  mode?: 'create' | 'edit';
  electionId?: string;
  initialData?: ElectionDetail;
}

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

function wcToState(wc: WinningConditions): WinningConditionsState {
  return {
    hasMostVotes: wc.hasMostVotes,
    reachesPercentageEnabled: wc.reachesPercentage !== null,
    reachesPercentage: wc.reachesPercentage ?? 50,
    reachesVotesEnabled: wc.reachesVotes !== null,
    reachesVotes: wc.reachesVotes ?? 10,
    quorumEnabled: wc.quorum !== null,
    quorum: wc.quorum ?? 100,
  };
}

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
  initialGroupMembershipId = null,
  mode = 'create',
  electionId,
  initialData,
}: CreateElectionFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = mode === 'edit';

  const [facultyGroups, setFacultyGroups] = useState<Record<string, string[]>>({});
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState<string | null>(null);

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
    if (aNN !== bNN) {
      return aNN ? 1 : -1;
    }
    return a.localeCompare(b, 'uk');
  });

  // ── Derive initial values from initialData when in edit mode ──────────────
  const getInitialFaculties = () => {
    if (!initialData) {
      return restrictedToFaculty ? [restrictedToFaculty] : [];
    }
    return initialData.restrictions.filter((r) => r.type === 'FACULTY').map((r) => r.value);
  };

  const getInitialGroups = () => {
    if (!initialData) {
      return [];
    }
    return initialData.restrictions.filter((r) => r.type === 'GROUP').map((r) => r.value);
  };

  const getInitialForms = () => {
    if (!initialData) {
      return [];
    }
    return initialData.restrictions.filter((r) => r.type === 'STUDY_FORM').map((r) => r.value);
  };

  const getInitialLevelCourses = () => {
    if (!initialData) {
      return [];
    }
    return initialData.restrictions.filter((r) => r.type === 'LEVEL_COURSE').map((r) => r.value);
  };

  const getInitialGroupMemberships = () => {
    if (!initialData) {
      return initialGroupMembershipId ? [initialGroupMembershipId] : [];
    }
    const fromData = initialData.restrictions
      .filter((r) => r.type === 'GROUP_MEMBERSHIP')
      .map((r) => r.value);
    if (fromData.length > 0) {
      return fromData;
    }
    return initialGroupMembershipId ? [initialGroupMembershipId] : [];
  };

  const getInitialBypassRequired = () => {
    if (!initialData) {
      return false;
    }
    return initialData.restrictions.some((r) => r.type === 'BYPASS_REQUIRED');
  };

  const {
    control,
    register,
    handleSubmit,
    setValue,
    getValues,
    setError,
    clearErrors,
    trigger,
    formState: { errors, isSubmitting: loading, isSubmitted },
  } = useForm<ElectionFormValues>({
    resolver: zodResolver(createElectionFormSchema(facultyGroups, groupsLoading)),
    defaultValues: {
      title: initialData?.title ?? '',
      description: initialData?.description ?? '',
      opensAt: initialData?.opensAt ?? '',
      closesAt: initialData?.closesAt ?? '',
      minChoices: initialData?.minChoices ?? 1,
      maxChoices: initialData?.maxChoices ?? 1,
      winningConditions: initialData?.winningConditions
        ? wcToState(initialData.winningConditions)
        : DEFAULT_WC_STATE,
      faculties: getInitialFaculties(),
      groups: getInitialGroups(),
      studyForms: getInitialForms(),
      levelCourses: getInitialLevelCourses(),
      groupMemberships: getInitialGroupMemberships(),
      bypassRequired: getInitialBypassRequired(),
      includeFacultyRestriction: true,
      shuffleChoices: initialData?.shuffleChoices ?? false,
      publicViewing: initialData?.publicViewing ?? false,
      anonymous: initialData?.anonymous ?? true,
      choices: initialData?.choices?.map(({ choice }) => ({ value: choice })) ?? [
        { value: '' },
        { value: '' },
      ],
    },
  });
  const form = useWatch({ control }) as ElectionFormValues;
  const { fields: choices, append, remove } = useFieldArray({ control, name: 'choices' });
  const {
    faculties: selectedFaculties,
    groups: selectedGroups,
    studyForms: selectedForms,
    levelCourses: selectedLevelCourses,
    groupMemberships: selectedGroupMemberships,
    winningConditions: winningConditionsState,
    bypassRequired,
    includeFacultyRestriction,
    shuffleChoices,
    publicViewing,
    anonymous,
  } = form;
  const error = errors.root?.message;
  const winningConditionErrors = {
    reachesPercentage: errors.winningConditions?.reachesPercentage?.message ?? '',
    reachesVotes: errors.winningConditions?.reachesVotes?.message ?? '',
    quorum: errors.winningConditions?.quorum?.message ?? '',
  };

  function updateField<K extends FieldPath<ElectionFormValues>>(
    name: K,
    value: FieldPathValue<ElectionFormValues, K>,
  ) {
    setValue(name, value, { shouldDirty: true });
    if (isSubmitted) {
      void trigger();
    }
    clearErrors('root');
  }

  const canBypassFaculty = !!restrictedToFaculty && selectedGroupMemberships.length > 0;
  useEffect(() => {
    if (!canBypassFaculty) {
      setValue('includeFacultyRestriction', true);
    }
  }, [canBypassFaculty, setValue]);

  const availableGroups = useMemo(
    () =>
      getElectionCampusGroups(
        facultyGroups,
        selectedFaculties,
        selectedForms,
        selectedLevelCourses,
      ),
    [facultyGroups, selectedFaculties, selectedForms, selectedLevelCourses],
  );
  useEffect(() => {
    if (groupsLoading) {
      return;
    }
    const current = getValues('groups');
    const next = current.filter((group) => availableGroups.includes(group));
    if (next.length !== current.length) {
      setValue('groups', next);
      if (isSubmitted) {
        void trigger();
      }
    }
  }, [availableGroups, groupsLoading, getValues, setValue, isSubmitted, trigger]);

  useEffect(() => {
    if (choices.length <= 1) {
      setValue('shuffleChoices', false);
    }
    setValue('minChoices', Math.min(getValues('minChoices'), choices.length));
    setValue('maxChoices', Math.min(getValues('maxChoices'), choices.length));
    if (isSubmitted) {
      void trigger();
    }
  }, [choices.length, getValues, setValue, isSubmitted, trigger]);

  const noGroupsMatchCriteria =
    selectedFaculties.length > 0 &&
    availableGroups.length === 0 &&
    (selectedForms.length > 0 || selectedLevelCourses.length > 0) &&
    !groupsLoading;

  function getRestrictions(values: ElectionFormValues): CreateElectionRestriction[] {
    return [
      ...(restrictedToFaculty && !values.includeFacultyRestriction
        ? []
        : values.faculties.map((v) => ({ type: 'FACULTY' as const, value: v }))),
      ...values.groups.map((v) => ({ type: 'GROUP' as const, value: v })),
      ...values.studyForms.map((v) => ({ type: 'STUDY_FORM' as const, value: v })),
      ...values.levelCourses.map((v) => ({ type: 'LEVEL_COURSE' as const, value: v })),
      ...values.groupMemberships.map((v) => ({ type: 'GROUP_MEMBERSHIP' as const, value: v })),
      ...(values.bypassRequired ? [{ type: 'BYPASS_REQUIRED' as const, value: 'true' }] : []),
    ];
  }
  const restrictions = getRestrictions(form);

  const onSubmit = async (values: ElectionFormValues) => {
    clearErrors('root');
    const restrictions = getRestrictions(values);
    const filteredChoices = values.choices.map(({ value }) => value.trim());
    const trimmedDescription = values.description.trim();
    const payload = {
      title: values.title.trim(),
      description: trimmedDescription ? trimmedDescription : null,
      opensAt: new Date(values.opensAt).toISOString(),
      closesAt: new Date(values.closesAt).toISOString(),
      choices: filteredChoices,
      minChoices: Math.min(values.minChoices, filteredChoices.length),
      maxChoices: Math.min(values.maxChoices, filteredChoices.length),
      restrictions,
      winningConditions: wcStateToPayload(values.winningConditions, filteredChoices.length),
      shuffleChoices: filteredChoices.length > 1 && values.shuffleChoices,
      publicViewing: restrictions.length === 0 || values.publicViewing,
      anonymous: values.anonymous,
    };

    if (isEdit && electionId) {
      const result = await api.elections.update(electionId, payload);
      if (result.success) {
        toast({
          title: 'Голосування оновлено!',
          description: `"${values.title}" успішно оновлено.`,
          variant: 'success',
          duration: 6000,
        });
        router.push(`/admin/elections/${electionId}`);
        router.refresh();
      } else {
        setError('root', { message: result.error });
      }
    } else {
      const result = await api.elections.create(payload);
      if (result.success) {
        toast({
          title: 'Голосування створено!',
          description: `"${values.title}" успішно опубліковано.`,
          variant: 'success',
          duration: 6000,
        });
        router.push(`/admin/elections/${result.data.id}`);
      } else {
        setError('root', { message: result.error });
      }
    }
  };

  const [renderTime] = useState(() => Date.now());
  const minDateTime = new Date(renderTime + 60 * 1000);
  const maxOpensAt = new Date(
    renderTime + ELECTION_MAX_CLOSES_AT_DAYS * 24 * 60 * 60 * 1000 - 60 * 1000,
  );
  const maxClosesAt = new Date(renderTime + ELECTION_MAX_CLOSES_AT_DAYS * 24 * 60 * 60 * 1000);

  const studyFormOptions = UI_STUDY_FORMS.map((f) => ({
    value: f,
    label: STUDY_FORM_LABELS[f],
  }));

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit, () =>
        setError('root', { message: 'Будь ласка, виправте підсвічені помилки валідації' }),
      )}
      onChange={() => clearErrors('root')}
      className="space-y-8"
    >
      {/* ── Basic info ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 font-display text-xl font-semibold text-foreground">
          Основна інформація
        </h2>
        <div className="space-y-5">
          <FormField label="Назва" required error={errors.title?.message} htmlFor="title">
            <div className="space-y-1">
              <Input
                id="title"
                {...register('title')}
                placeholder="Введіть назву голосування"
                error={!!errors.title?.message || form.title.length > ELECTION_TITLE_MAX_LENGTH}
              />
              <div className="flex justify-end">
                <CharCounter value={form.title} max={ELECTION_TITLE_MAX_LENGTH} />
              </div>
            </div>
          </FormField>

          <FormField
            label="Опис голосування"
            error={errors.description?.message}
            htmlFor="description"
            hint="Необов'язково"
          >
            <div className="space-y-1">
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Коротко опишіть мету голосування, контекст і деталі"
                rows={4}
                maxLength={ELECTION_DESCRIPTION_MAX_LENGTH}
                error={
                  !!errors.description?.message ||
                  form.description.length > ELECTION_DESCRIPTION_MAX_LENGTH
                }
              />
              <div className="flex justify-end">
                <CharCounter value={form.description} max={ELECTION_DESCRIPTION_MAX_LENGTH} />
              </div>
            </div>
          </FormField>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField label="Початок" required error={errors.opensAt?.message} htmlFor="opensAt">
              <Controller
                control={control}
                name="opensAt"
                render={({ field }) => (
                  <KyivDateTimePicker
                    id="opensAt"
                    value={field.value}
                    onChange={(date) => {
                      field.onChange(date.toISOString());
                      clearErrors('root');
                    }}
                    ref={field.ref}
                    min={minDateTime}
                    max={maxOpensAt}
                    minuteStep={30}
                    error={!!errors.opensAt?.message}
                  />
                )}
              />
            </FormField>
            <FormField
              label="Завершення"
              required
              error={errors.closesAt?.message}
              htmlFor="closesAt"
            >
              <Controller
                control={control}
                name="closesAt"
                render={({ field }) => (
                  <KyivDateTimePicker
                    id="closesAt"
                    value={field.value}
                    onChange={(date) => {
                      field.onChange(date.toISOString());
                      clearErrors('root');
                    }}
                    ref={field.ref}
                    min={form.opensAt || minDateTime}
                    max={maxClosesAt}
                    minuteStep={30}
                    error={!!errors.closesAt?.message}
                  />
                )}
              />
            </FormField>
          </div>
        </div>
      </section>

      {/* ── Choices ────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 font-display text-xl font-semibold text-foreground">
          Варіанти відповідей
        </h2>
        <p className="font-body mb-4 text-sm text-muted-foreground">
          Додайте від {ELECTION_CHOICES_MIN} до {ELECTION_CHOICES_MAX} варіантів
        </p>
        {errors.choices?.root?.message && (
          <Alert variant="error" className="mb-3">
            {errors.choices?.root?.message}
          </Alert>
        )}

        <div className="space-y-3">
          {choices.map((choice, index) => (
            <div key={choice.id} className="flex items-start gap-3">
              <div className="flex-1 space-y-1">
                <Input
                  {...register(`choices.${index}.value`)}
                  placeholder={`Варіант ${index + 1}`}
                  error={
                    !!errors.choices?.[index]?.value?.message ||
                    (form.choices[index]?.value ?? choice.value).length > ELECTION_CHOICE_MAX_LENGTH
                  }
                />
                <div className="flex items-center justify-between">
                  {errors.choices?.[index]?.value?.message ? (
                    <p className="text-xs text-error">{errors.choices?.[index]?.value?.message}</p>
                  ) : (
                    <span />
                  )}
                  <CharCounter
                    value={form.choices[index]?.value ?? choice.value}
                    max={ELECTION_CHOICE_MAX_LENGTH}
                  />
                </div>
              </div>
              {choices.length > ELECTION_CHOICES_MIN && (
                <button
                  type="button"
                  onClick={() => {
                    remove(index);
                    clearErrors('root');
                  }}
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-(--radius)',
                    'text-muted-foreground transition-colors duration-150 hover:bg-error-bg hover:text-error',
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
            onClick={() => {
              append({ value: '' });
              clearErrors('root');
            }}
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
            onChange={(value) => updateField('shuffleChoices', value)}
            className="mt-6"
          />
        )}

        {/* Min/Max choices */}
        {choices.length > 1 && (
          <div className="mt-6">
            <FormField
              label="Дозволено обирати варіантів"
              required
              error={errors.minChoices?.message || errors.maxChoices?.message}
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
                  updateField('minChoices', newMin);
                  updateField('maxChoices', newMax);
                }}
                className="my-5"
              />
              <div className="font-body flex items-center justify-between text-sm font-medium">
                <div className="flex flex-col items-start">
                  <span className="text-xs text-muted-foreground">Мінімум</span>
                  <span className="text-foreground">
                    {Math.min(form.minChoices, choices.length)}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-muted-foreground">Максимум</span>
                  <span className="text-foreground">
                    {Math.min(form.maxChoices, choices.length)}
                  </span>
                </div>
              </div>
            </FormField>
          </div>
        )}
      </section>

      {/* ── Election validity ──────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 font-display text-xl font-semibold text-foreground">
          Умови дійсності голосування
        </h2>
        <p className="font-body mb-4 text-sm text-muted-foreground">
          Визначте, які критерії встановлюють дійсність голосування. Якщо критерії не встановлено,
          достатньо одного голосу.
        </p>
        <WinningConditionsSection
          section="validity"
          state={winningConditionsState}
          validChoicesCount={choices.length}
          onChange={(next) => updateField('winningConditions', next)}
          errors={winningConditionErrors}
        />
      </section>

      {/* ── Winning conditions ──────────────────────────────────────────────── */}
      {choices.length > 1 && (
        <section>
          <h2 className="mb-1 font-display text-xl font-semibold text-foreground">
            Умови перемоги
          </h2>
          <p className="font-body mb-4 text-sm text-muted-foreground">
            Визначте, за якими критеріями обирається переможець. Усі вибрані умови застосовуються
            одночасно.
          </p>
          <WinningConditionsSection
            section="winning"
            state={winningConditionsState}
            validChoicesCount={choices.length}
            onChange={(next) => updateField('winningConditions', next)}
            errors={winningConditionErrors}
          />
          {errors.winningConditions?.root?.message && (
            <p className="mt-2 text-sm text-error">{errors.winningConditions?.root?.message}</p>
          )}
        </section>
      )}

      {/* ── Access restrictions ─────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 font-display text-xl font-semibold text-foreground">
          Обмеження доступу
        </h2>
        <p className="font-body mb-4 text-sm text-muted-foreground">
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
            error={errors.faculties?.message}
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
                  <div className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-kpi-gray-mid">
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
                    onChange={(value) => updateField('includeFacultyRestriction', value)}
                  />
                )}
              </div>
            ) : (
              <MultiCombobox
                id="faculties"
                options={groupsLoading ? [] : facultyOptions}
                value={selectedFaculties}
                onChange={(value) => {
                  if (!restrictedToFaculty) {
                    updateField('faculties', value);
                  }
                }}
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
              onChange={(value) => updateField('studyForms', value)}
            />
          </FormField>

          {/* Level & course */}
          <FormField label="Рівень та курс" error={errors.levelCourses?.message}>
            <div className={`grid grid-cols-1 gap-4 sm:grid-cols-${LEVEL_COLUMNS.length}`}>
              {LEVEL_COLUMNS.map(({ key, label, courses }) => (
                <div key={key} className="space-y-2">
                  <p className="font-body text-sm font-medium text-foreground">{label}</p>
                  <div className="flex flex-wrap gap-2">
                    {courses.map((course) => {
                      const value = `${key}${course}`;
                      const isSelected = selectedLevelCourses.includes(value);
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            updateField(
                              'levelCourses',
                              selectedLevelCourses.includes(value)
                                ? selectedLevelCourses.filter((course) => course !== value)
                                : [...selectedLevelCourses, value],
                            )
                          }
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-(--radius) border',
                            'font-body text-sm font-semibold transition-colors duration-150',
                            'focus-visible:ring-2 focus-visible:ring-kpi-blue-light focus-visible:outline-none',
                            isSelected
                              ? 'border-kpi-navy bg-kpi-navy text-white shadow-sm'
                              : 'border-border-color bg-card text-foreground hover:border-kpi-blue-light',
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

            {noGroupsMatchCriteria && !errors.levelCourses?.message && (
              <p className="mt-2 text-sm text-warning">
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
              onChange={(value) => updateField('groups', value)}
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
                <p className="font-body text-sm text-muted-foreground">Завантаження…</p>
              ) : ownedGroups.length === 0 ? (
                <p className="font-body text-sm text-muted-foreground italic">
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
                          updateField(
                            'groupMemberships',
                            isSelected
                              ? selectedGroupMemberships.filter((id) => id !== grp.id)
                              : [...selectedGroupMemberships, grp.id],
                          );
                        }}
                        className={cn(
                          'font-body min-w-0 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-all duration-150',
                          'focus-visible:ring-2 focus-visible:ring-kpi-blue-light focus-visible:outline-none',
                          isSelected
                            ? 'border-kpi-navy bg-kpi-navy text-white shadow-sm'
                            : 'border-border-color bg-card text-foreground hover:border-kpi-blue-light',
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
            onChange={(value) => updateField('bypassRequired', value)}
          />

          {restrictions.length > 0 && (
            <ToggleField
              label="Публічний перегляд"
              description="Будь-який авторизований користувач може переглядати сторінку голосування."
              checked={publicViewing}
              onChange={(value) => updateField('publicViewing', value)}
            />
          )}

          <ToggleField
            label="Анонімне голосування"
            description="Особи учасників криптографічно захищені й не можуть бути розкриті"
            checked={anonymous}
            onChange={(value) => updateField('anonymous', value)}
          />

          {!anonymous && (
            <Alert variant="warning" title="Голосування не є анонімним">
              Під час голосування ПІБ та ідентифікатор кожного учасника будуть відображені поруч із
              їхнім зашифрованим бюлетенем. Ця інформація стане доступною для всіх, хто має право
              переглядати сторінку бюлетенів.
            </Alert>
          )}
        </div>
      </section>

      {/* ── Submit ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
        {error && (
          <Alert variant="error" title="Помилка" onDismiss={() => clearErrors('root')}>
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
            {isEdit ? 'Зберегти зміни' : 'Створити голосування'}
          </Button>
        </div>
      </div>
    </form>
  );
}
