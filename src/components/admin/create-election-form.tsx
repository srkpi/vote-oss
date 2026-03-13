'use client';

import { Lock, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CharCounter } from '@/components/ui/char-counter';
import { Combobox } from '@/components/ui/combobox';
import { FormField, Input } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { createElection } from '@/lib/api-client';
import {
  ELECTION_CHOICE_MAX_LENGTH,
  ELECTION_CHOICES_MAX,
  ELECTION_CHOICES_MIN,
  ELECTION_TITLE_MAX_LENGTH,
} from '@/lib/constants';
import { cn } from '@/lib/utils';

interface CreateElectionFormProps {
  restrictedToFaculty: string | null;
}

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
        setGroupsError('Не вдалося завантажити список факультетів і груп');
        setGroupsLoading(false);
      });
  }, []);

  // Sorted faculty names: regular faculties first (A-Z), НН ones last (A-Z)
  const facultyOptions = Object.keys(facultyGroups).sort((a, b) => {
    const aIsNN = a.startsWith('НН ');
    const bIsNN = b.startsWith('НН ');
    if (aIsNN !== bIsNN) return aIsNN ? 1 : -1;
    return a.localeCompare(b, 'uk');
  });

  const [form, setForm] = useState({
    title: '',
    opensAt: '',
    closesAt: '',
    restrictedToFaculty: restrictedToFaculty ?? '',
    restrictedToGroup: '',
  });

  const [choices, setChoices] = useState(['', '']);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  };

  // When the faculty changes, always reset the group selection
  const handleFacultyChange = (faculty: string) => {
    setForm((prev) => ({ ...prev, restrictedToFaculty: faculty, restrictedToGroup: '' }));
    setFieldErrors((prev) => ({ ...prev, restrictedToFaculty: '', restrictedToGroup: '' }));
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
    if (choices.length < ELECTION_CHOICES_MAX) setChoices((prev) => [...prev, '']);
  };

  const removeChoice = (index: number) => {
    if (choices.length > ELECTION_CHOICES_MIN) {
      setChoices((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const groupOptions = form.restrictedToFaculty
    ? (facultyGroups[form.restrictedToFaculty] ?? [])
    : [];

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.title.trim()) {
      errors.title = "Назва обов'язкова";
    } else if (form.title.length > ELECTION_TITLE_MAX_LENGTH) {
      errors.title = `Назва не може перевищувати ${ELECTION_TITLE_MAX_LENGTH} символів`;
    }

    if (!form.opensAt) errors.opensAt = "Дата початку обов'язкова";
    if (!form.closesAt) errors.closesAt = "Дата завершення обов'язкова";

    const openDate = new Date(form.opensAt);
    const closeDate = new Date(form.closesAt);

    if (form.opensAt && form.closesAt && closeDate <= openDate) {
      errors.closesAt = 'Дата завершення має бути після дати початку';
    }

    choices.forEach((choice, i) => {
      if (!choice.trim()) {
        errors[`choice_${i}`] = 'Варіант не може бути порожнім';
      } else if (choice.length > ELECTION_CHOICE_MAX_LENGTH) {
        errors[`choice_${i}`] =
          `Варіант не може перевищувати ${ELECTION_CHOICE_MAX_LENGTH} символів`;
      }
    });

    const uniqueChoices = new Set(choices.map((c) => c.trim().toLowerCase()));
    if (uniqueChoices.size !== choices.length) {
      errors.choices = 'Варіанти не можуть повторюватися';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const hasOverLimit =
    form.title.length > ELECTION_TITLE_MAX_LENGTH ||
    choices.some((c) => c.length > ELECTION_CHOICE_MAX_LENGTH);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError(null);

    const result = await createElection({
      title: form.title.trim(),
      opensAt: new Date(form.opensAt).toISOString(),
      closesAt: new Date(form.closesAt).toISOString(),
      choices: choices.filter((c) => c.trim()),
      restrictedToFaculty: form.restrictedToFaculty.trim() || null,
      restrictedToGroup: form.restrictedToGroup.trim() || null,
    });

    if (result.success) {
      toast({
        title: 'Голосування створено!',
        description: `"${form.title}" успішно опубліковано.`,
        variant: 'success',
        duration: 6000,
      });
      router.push(`/elections/${result.data.id}`);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const [minDateTime] = useState(() => new Date(Date.now() + 60000).toISOString().slice(0, 16));

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <Alert variant="error" title="Помилка" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Basic Info */}
      <section>
        <h2 className="font-display text-xl font-semibold text-[var(--foreground)] mb-4">
          Створення голосування
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FormField label="Початок" required error={fieldErrors.opensAt} htmlFor="opensAt">
              <Input
                id="opensAt"
                type="datetime-local"
                value={form.opensAt}
                onChange={(e) => updateForm('opensAt', e.target.value)}
                min={minDateTime}
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
                error={!!fieldErrors.closesAt}
              />
            </FormField>
          </div>
        </div>
      </section>

      {/* Choices */}
      <section>
        <h2 className="font-display text-xl font-semibold text-[var(--foreground)] mb-1">
          Варіанти відповідей
        </h2>
        <p className="text-sm text-[var(--muted-foreground)] font-body mb-4">
          Додайте від {ELECTION_CHOICES_MIN} до {ELECTION_CHOICES_MAX} варіантів
        </p>

        {fieldErrors.choices && (
          <Alert variant="error" className="mb-3">
            {fieldErrors.choices}
          </Alert>
        )}

        <div className="space-y-3">
          {choices.map((choice, index) => {
            const isOverLimit = choice.length > ELECTION_CHOICE_MAX_LENGTH;
            return (
              <div key={index} className="flex items-start gap-3">
                <div className="w-8 h-10 flex items-center justify-center shrink-0">
                  <span className="w-7 h-7 rounded-lg navy-gradient flex items-center justify-center text-white text-xs font-bold font-body">
                    {String.fromCharCode(65 + index)}
                  </span>
                </div>
                <div className="flex-1 space-y-1">
                  <Input
                    value={choice}
                    onChange={(e) => updateChoice(index, e.target.value)}
                    placeholder={`Варіант ${String.fromCharCode(65 + index)}`}
                    error={!!fieldErrors[`choice_${index}`] || isOverLimit}
                  />
                  <div className="flex items-center justify-between">
                    {fieldErrors[`choice_${index}`] ? (
                      <p className="text-xs text-[var(--error)]">
                        {fieldErrors[`choice_${index}`]}
                      </p>
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
                      'w-10 h-10 flex items-center justify-center shrink-0 rounded-[var(--radius)]',
                      'text-[var(--muted-foreground)] hover:text-[var(--error)] hover:bg-[var(--error-bg)]',
                      'transition-colors duration-150',
                    )}
                    aria-label="Видалити варіант"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {choices.length < ELECTION_CHOICES_MAX && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={addChoice}
            icon={<Plus className="w-4 h-4" />}
          >
            Додати варіант
          </Button>
        )}
      </section>

      {/* Access Restrictions */}
      <section>
        <h2 className="font-display text-xl font-semibold text-[var(--foreground)] mb-1">
          Обмеження доступу
        </h2>
        <p className="text-sm text-[var(--muted-foreground)] font-body mb-4">
          Залиште порожнім для всіх студентів. Групу можна вибрати лише після вибору факультету.
        </p>

        {groupsError && (
          <Alert variant="warning" className="mb-4">
            {groupsError}
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Faculty picker */}
          <FormField
            label="Обмежити підрозділом"
            htmlFor="faculty"
            hint={
              restrictedToFaculty
                ? 'Акаунт обмежений одним підрозділом'
                : 'Наприклад: FICE, ФЕЛ, ФІОТ'
            }
          >
            {restrictedToFaculty ? (
              /* Locked – admin is faculty-restricted */
              <div className="relative">
                <Input
                  id="faculty"
                  value={form.restrictedToFaculty}
                  readOnly
                  className="bg-[var(--surface)] cursor-not-allowed pr-9"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--kpi-gray-mid)] pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
              </div>
            ) : (
              /* Free combobox */
              <Combobox
                id="faculty"
                options={groupsLoading ? [] : facultyOptions}
                value={form.restrictedToFaculty}
                onChange={handleFacultyChange}
                placeholder={groupsLoading ? 'Завантаження…' : 'Без обмеження'}
                searchPlaceholder="Пошук факультету…"
                clearable
                disabled={groupsLoading}
                error={!!fieldErrors.restrictedToFaculty}
                emptyText="Факультет не знайдено"
              />
            )}
          </FormField>

          {/* Group picker */}
          <FormField
            label="Обмежити групою"
            htmlFor="group"
            hint={
              !form.restrictedToFaculty
                ? 'Спочатку оберіть факультет'
                : groupOptions.length === 0 && !groupsLoading
                  ? 'Немає груп для цього факультету'
                  : "Не обов'язково"
            }
          >
            <Combobox
              id="group"
              options={groupOptions}
              value={form.restrictedToGroup}
              onChange={(v) => updateForm('restrictedToGroup', v)}
              placeholder="Без обмеження"
              searchPlaceholder="Пошук групи…"
              clearable
              disabled={!form.restrictedToFaculty || groupsLoading}
              error={!!fieldErrors.restrictedToGroup}
              emptyText="Групу не знайдено"
            />
          </FormField>
        </div>
      </section>

      {/* Submit */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-[var(--border-subtle)]">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => router.back()}
          disabled={loading}
        >
          Скасувати
        </Button>
        <Button
          type="submit"
          variant="accent"
          size="lg"
          loading={loading}
          disabled={hasOverLimit}
          icon={<Plus className="w-4 h-4" />}
        >
          Створити голосування
        </Button>
      </div>
    </form>
  );
}
