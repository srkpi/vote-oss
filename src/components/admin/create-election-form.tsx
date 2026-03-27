'use client';

import { Lock, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CharCounter } from '@/components/ui/char-counter';
import { ChipSelect } from '@/components/ui/chip-select';
import { FormField, Input } from '@/components/ui/form';
import { MultiCombobox } from '@/components/ui/multi-combobox';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import {
  ELECTION_CHOICE_MAX_LENGTH,
  ELECTION_CHOICES_MAX,
  ELECTION_CHOICES_MIN,
  ELECTION_MAX_CHOICES_MAX,
  ELECTION_MAX_CLOSES_AT_DAYS,
  ELECTION_MIN_CHOICES_MIN,
  ELECTION_TITLE_MAX_LENGTH,
  LEVEL_COURSE_BACHELOR_COURSES,
  // LEVEL_COURSE_GRADUATE_COURSES,
  LEVEL_COURSE_MASTER_COURSES,
  STUDY_FORM_LABELS,
  UI_STUDY_FORMS,
  //STUDY_YEARS,
} from '@/lib/constants';
import { filterGroupsByLevelCourses, filterGroupsByStudyForms } from '@/lib/group-utils';
import { cn } from '@/lib/utils';
import type { CreateElectionRestriction } from '@/types/election';

interface CreateElectionFormProps {
  restrictedToFaculty: string | null;
}

const LEVEL_COLUMNS = [
  { key: 'b', label: 'Бакалаври', courses: LEVEL_COURSE_BACHELOR_COURSES },
  { key: 'm', label: 'Магістри', courses: LEVEL_COURSE_MASTER_COURSES },
  // { key: 'g', label: 'Аспіранти', courses: LEVEL_COURSE_GRADUATE_COURSES },
] as const;

export function CreateElectionForm({ restrictedToFaculty = null }: CreateElectionFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [facultyGroups, setFacultyGroups] = useState<Record<string, string[]>>({});
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/campus/groups', { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Record<string, string[]>>;
      })
      .then((data) => {
        setFacultyGroups(data);
        setGroupsLoading(false);
      })
      .catch(() => {
        setGroupsError('Не вдалося завантажити список підрозділів і груп');
        setGroupsLoading(false);
      });
  }, []);

  const facultyOptions = Object.keys(facultyGroups).sort((a, b) => {
    const aNN = a.startsWith('НН ');
    const bNN = b.startsWith('НН ');
    if (aNN !== bNN) return aNN ? 1 : -1;
    return a.localeCompare(b, 'uk');
  });

  const [form, setForm] = useState({
    title: '',
    opensAt: '',
    closesAt: '',
    minChoices: 1,
    maxChoices: 1,
  });

  const [selectedFaculties, setSelectedFaculties] = useState<string[]>(
    restrictedToFaculty ? [restrictedToFaculty] : [],
  );
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedForms, setSelectedForms] = useState<string[]>([]);
  const [selectedLevelCourses, setSelectedLevelCourses] = useState<string[]>([]);
  const [choices, setChoices] = useState(['', '']);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validChoicesCount = choices.filter((c) => c.trim()).length;

  // ── Available groups: filtered by faculties, study forms, and level courses ──
  const availableGroups = useMemo(() => {
    let groups = Array.from(new Set(selectedFaculties.flatMap((f) => facultyGroups[f] ?? []))).sort(
      (a, b) => a.localeCompare(b, 'uk'),
    );

    if (selectedForms.length > 0) {
      groups = filterGroupsByStudyForms(groups, selectedForms);
    }

    if (selectedLevelCourses.length > 0) {
      groups = filterGroupsByLevelCourses(groups, selectedLevelCourses);
    }

    return groups;
  }, [selectedFaculties, facultyGroups, selectedForms, selectedLevelCourses]);

  // Remove selected groups that no longer appear in the filtered list
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedGroups((prev) => prev.filter((g) => availableGroups.includes(g)));
  }, [availableGroups]);

  // True when faculties are chosen but active filters leave zero matching groups
  const noGroupsMatchCriteria =
    selectedFaculties.length > 0 &&
    availableGroups.length === 0 &&
    (selectedForms.length > 0 || selectedLevelCourses.length > 0) &&
    !groupsLoading;

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleFacultiesChange(faculties: string[]) {
    if (restrictedToFaculty) return; // locked
    setSelectedFaculties(faculties);
    setFieldErrors((p) => ({ ...p, faculties: '' }));
  }

  const updateForm = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const updateChoice = (index: number, value: string) => {
    setChoices((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setFieldErrors((prev) => ({ ...prev, [`choice_${index}`]: '' }));
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
  };

  // ── Validation ────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.title.trim()) errors.title = "Назва обов'язкова";
    else if (form.title.length > ELECTION_TITLE_MAX_LENGTH)
      errors.title = `Назва не може перевищувати ${ELECTION_TITLE_MAX_LENGTH} символів`;

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

    if (form.minChoices < ELECTION_MIN_CHOICES_MIN)
      errors.minChoices = `Мінімум ${ELECTION_MIN_CHOICES_MIN}`;
    if (form.maxChoices > ELECTION_MAX_CHOICES_MAX)
      errors.maxChoices = `Максимум ${ELECTION_MAX_CHOICES_MAX}`;
    if (form.maxChoices < form.minChoices) errors.maxChoices = 'Не менше за мінімум';
    if (form.maxChoices > validChoicesCount) errors.maxChoices = 'Не більше за кількість варіантів';

    if (noGroupsMatchCriteria) {
      errors.levelCourses =
        'Жодна група не відповідає вибраним обмеженням. Змініть критерії або приберіть деякі фільтри.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError(null);

    const restrictions: CreateElectionRestriction[] = [
      ...selectedFaculties.map((v) => ({ type: 'FACULTY' as const, value: v })),
      ...selectedGroups.map((v) => ({ type: 'GROUP' as const, value: v })),
      ...selectedYears.map((v) => ({ type: 'STUDY_YEAR' as const, value: v })),
      ...selectedForms.map((v) => ({ type: 'STUDY_FORM' as const, value: v })),
      ...selectedLevelCourses.map((v) => ({ type: 'LEVEL_COURSE' as const, value: v })),
    ];

    const result = await api.createElection({
      title: form.title.trim(),
      opensAt: new Date(form.opensAt).toISOString(),
      closesAt: new Date(form.closesAt).toISOString(),
      choices: choices.filter((c) => c.trim()),
      minChoices: form.minChoices,
      maxChoices: form.maxChoices,
      restrictions,
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

  // ── Date helpers ──────────────────────────────────────────────────────────

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

  //const studyYearOptions = STUDY_YEARS.map((y) => ({ value: String(y), label: String(y) }));
  const studyFormOptions = UI_STUDY_FORMS.map((f) => ({ value: f, label: STUDY_FORM_LABELS[f] }));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <Alert variant="error" title="Помилка" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Basic info */}
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

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField label="Початок" required error={fieldErrors.opensAt} htmlFor="opensAt">
              <Input
                id="opensAt"
                type="datetime-local"
                value={form.opensAt}
                onChange={(e) => updateForm('opensAt', e.target.value)}
                min={minDateTime}
                max={maxOpensAt}
                error={!!fieldErrors.opensAt}
              />
            </FormField>
            <FormField label="Завершення" required error={fieldErrors.closesAt} htmlFor="closesAt">
              <Input
                id="closesAt"
                type="datetime-local"
                value={form.closesAt}
                onChange={(e) => updateForm('closesAt', e.target.value)}
                min={form.opensAt || minDateTime}
                max={maxClosesAt}
                error={!!fieldErrors.closesAt}
              />
            </FormField>
          </div>
        </div>
      </section>

      {/* Choices + min/max */}
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

        {/* Min/Max choices */}
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
                Math.min(ELECTION_MAX_CHOICES_MAX, Math.max(validChoicesCount, 2)),
              )}
              step={1}
              value={[form.minChoices, form.maxChoices]}
              onValueChange={([newMin, newMax]) => {
                setForm((prev) => ({
                  ...prev,
                  minChoices: newMin,
                  maxChoices: newMax,
                }));
                setFieldErrors((prev) => ({
                  ...prev,
                  minChoices: '',
                  maxChoices: '',
                }));
              }}
              className="my-5"
            />
            <div className="font-body flex items-center justify-between text-sm font-medium">
              <div className="flex flex-col items-start">
                <span className="text-muted-foreground text-xs">Мінімум</span>
                <span className="text-foreground">{form.minChoices}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-muted-foreground text-xs">Максимум</span>
                <span className="text-foreground">{form.maxChoices}</span>
              </div>
            </div>
          </FormField>
        </div>
      </section>

      {/* Restrictions */}
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
          <FormField
            label="Підрозділ"
            htmlFor="faculties"
            hint={restrictedToFaculty ? 'Акаунт обмежений одним підрозділом' : undefined}
          >
            {restrictedToFaculty ? (
              <div className="relative">
                <Input
                  value={restrictedToFaculty}
                  readOnly
                  className="bg-surface cursor-not-allowed pr-9"
                />
                <div className="text-kpi-gray-mid pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
                  <Lock className="h-4 w-4" />
                </div>
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

          <FormField label="Форма навчання">
            <ChipSelect
              options={studyFormOptions}
              value={selectedForms}
              onChange={(forms) => {
                setSelectedForms(forms);
                setFieldErrors((prev) => ({ ...prev, levelCourses: '' }));
              }}
            />
          </FormField>

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

          {/* <FormField label="Рік навчання (загальний)">
            <ChipSelect
              options={studyYearOptions}
              value={selectedYears}
              onChange={setSelectedYears}
            />
          </FormField> */}

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
              onChange={setSelectedGroups}
              placeholder="Без обмеження"
              searchPlaceholder="Пошук групи…"
              disabled={selectedFaculties.length === 0 || groupsLoading || noGroupsMatchCriteria}
              emptyText="Групу не знайдено"
            />
          </FormField>
        </div>
      </section>

      <div className="border-border-subtle flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row">
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
    </form>
  );
}
