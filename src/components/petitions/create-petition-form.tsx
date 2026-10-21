'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CharCounter } from '@/components/ui/char-counter';
import { FormField, Input, Textarea } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import {
  PETITION_QUORUM,
  PETITION_TEXT_MAX_LENGTH,
  PETITION_TITLE_MAX_LENGTH,
} from '@/lib/constants';
import { petitionSubmissionSchema } from '@/lib/schemas/election';

export function CreatePetitionForm() {
  const router = useRouter();
  const { toast } = useToast();

  const [isNavigating, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof petitionSubmissionSchema>>({
    resolver: zodResolver(petitionSubmissionSchema),
    mode: 'onChange',
    defaultValues: { title: '', description: '' },
  });
  const [title, description] = useWatch({ control, name: ['title', 'description'] });
  const loading = isSubmitting || isNavigating;
  const error = errors.root?.message;

  const submitPetition = handleSubmit(async (values) => {
    const res = await api.elections.create({
      type: 'PETITION',
      ...values,
    });

    if (res.success) {
      toast({
        title: 'Петицію створено',
        description: res.data.approved
          ? 'Петиція одразу опублікована.'
          : 'Очікує апруву адміністратором.',
        variant: 'success',
      });
      startTransition(() => {
        router.push(`/petitions/${res.data.id}`);
        router.refresh();
      });
    } else {
      setError('root', { message: res.error });
    }
  });

  return (
    <form onSubmit={submitPetition} noValidate className="space-y-5">
      {error && (
        <Alert variant="error" onDismiss={() => clearErrors('root')}>
          {error}
        </Alert>
      )}

      <Alert variant="info">
        Кворум — {PETITION_QUORUM} підписів. Діє 1 місяць від апруву адміністратором.
      </Alert>

      <FormField label="Назва петиції" required htmlFor="title" error={errors.title?.message}>
        <Input
          id="title"
          {...register('title')}
          maxLength={PETITION_TITLE_MAX_LENGTH}
          error={!!errors.title}
          disabled={loading}
          placeholder="Коротко сформулюйте суть петиції"
        />
        <CharCounter value={title.length} max={PETITION_TITLE_MAX_LENGTH} />
      </FormField>

      <FormField label="Опис" required htmlFor="description" error={errors.description?.message}>
        <Textarea
          id="description"
          {...register('description')}
          maxLength={PETITION_TEXT_MAX_LENGTH}
          error={!!errors.description}
          disabled={loading}
          placeholder="Детально опишіть проблему та пропозицію"
          rows={8}
        />
        <CharCounter value={description.length} max={PETITION_TEXT_MAX_LENGTH} />
      </FormField>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => router.back()} disabled={loading}>
          Скасувати
        </Button>
        <Button type="submit" variant="accent" loading={loading}>
          Створити петицію
        </Button>
      </div>
    </form>
  );
}
