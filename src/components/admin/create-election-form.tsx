'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form';
import { Alert } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { createElection } from '@/lib/api-client';

export function CreateElectionForm() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    opensAt: '',
    closesAt: '',
    restrictedToFaculty: '',
    restrictedToGroup: '',
  });

  const [choices, setChoices] = useState(['', '']);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const updateForm = (field: string, value: string) => {
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
    if (choices.length < 10) setChoices((prev) => [...prev, '']);
  };

  const removeChoice = (index: number) => {
    if (choices.length > 2) {
      setChoices((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.title.trim()) errors.title = "Назва обов'язкова";
    if (!form.opensAt) errors.opensAt = "Дата початку обов'язкова";
    if (!form.closesAt) errors.closesAt = "Дата завершення обов'язкова";

    const openDate = new Date(form.opensAt);
    const closeDate = new Date(form.closesAt);

    if (form.opensAt && form.closesAt && closeDate <= openDate) {
      errors.closesAt = 'Дата завершення має бути після дати початку';
    }

    choices.forEach((choice, i) => {
      if (!choice.trim()) errors[`choice_${i}`] = 'Варіант не може бути порожнім';
    });

    const uniqueChoices = new Set(choices.map((c) => c.trim().toLowerCase()));
    if (uniqueChoices.size !== choices.length) {
      errors.choices = 'Варіанти не можуть повторюватися';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

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
            <Input
              id="title"
              value={form.title}
              onChange={(e) => updateForm('title', e.target.value)}
              placeholder="Введіть назву голосування"
              error={!!fieldErrors.title}
              maxLength={200}
            />
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
          Додайте від 2 до 10 варіантів
        </p>

        {fieldErrors.choices && (
          <Alert variant="error" className="mb-3">
            {fieldErrors.choices}
          </Alert>
        )}

        <div className="space-y-3">
          {choices.map((choice, index) => (
            <div
              key={index}
              className="flex items-start gap-3 animate-fade-up"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div className="w-8 h-10 flex items-center justify-center shrink-0">
                <span className="w-7 h-7 rounded-lg navy-gradient flex items-center justify-center text-white text-xs font-bold font-body">
                  {String.fromCharCode(65 + index)}
                </span>
              </div>
              <div className="flex-1">
                <Input
                  value={choice}
                  onChange={(e) => updateChoice(index, e.target.value)}
                  placeholder={`Варіант ${String.fromCharCode(65 + index)}`}
                  error={!!fieldErrors[`choice_${index}`]}
                  maxLength={200}
                />
                {fieldErrors[`choice_${index}`] && (
                  <p className="text-xs text-[var(--error)] mt-1">
                    {fieldErrors[`choice_${index}`]}
                  </p>
                )}
              </div>
              {choices.length > 2 && (
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
          ))}
        </div>

        {choices.length < 10 && (
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

      {/* Restrictions */}
      <section>
        <h2 className="font-display text-xl font-semibold text-[var(--foreground)] mb-1">
          Обмеження доступу
        </h2>
        <p className="text-sm text-[var(--muted-foreground)] font-body mb-4">
          Залиште порожнім для всіх студентів
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField
            label="Обмежити факультетом"
            htmlFor="faculty"
            hint="Наприклад: FICE, FEL, FMF"
          >
            <Input
              id="faculty"
              value={form.restrictedToFaculty}
              onChange={(e) => updateForm('restrictedToFaculty', e.target.value)}
              placeholder="Код факультету"
              maxLength={20}
            />
          </FormField>

          <FormField label="Обмежити групою" htmlFor="group" hint="Наприклад: КВ-91, ЕЛ-21">
            <Input
              id="group"
              value={form.restrictedToGroup}
              onChange={(e) => updateForm('restrictedToGroup', e.target.value)}
              placeholder="Код групи"
              maxLength={20}
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
          icon={<Plus className="w-4 h-4" />}
        >
          Створити голосування
        </Button>
      </div>
    </form>
  );
}
