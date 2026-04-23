'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CharCounter } from '@/components/ui/char-counter';
import { FormField, Input, Textarea } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import {
  ELECTION_DESCRIPTION_MAX_LENGTH,
  ELECTION_TITLE_MAX_LENGTH,
  PETITION_QUORUM,
} from '@/lib/constants';

export function CreatePetitionForm() {
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    title.length <= ELECTION_TITLE_MAX_LENGTH &&
    description.length <= ELECTION_DESCRIPTION_MAX_LENGTH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    const res = await api.elections.create({
      type: 'PETITION',
      title: title.trim(),
      description: description.trim(),
    });

    if (res.success) {
      toast({
        title: 'Петицію створено',
        description: res.data.approved
          ? 'Петиція одразу опублікована.'
          : 'Очікує апруву адміністратором.',
        variant: 'success',
      });
      router.push(`/petitions/${res.data.id}`);
      router.refresh();
    } else {
      setError(res.error);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Alert variant="info">
        Петиція має {PETITION_QUORUM} підписів для успіху і діє 1 місяць з моменту апруву
        адміністратором. Автоматично закривається при досягненні кворуму.
      </Alert>

      <FormField label="Назва петиції" required htmlFor="title">
        <Input
          id="title"
          value={title}
          maxLength={ELECTION_TITLE_MAX_LENGTH}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Коротко сформулюйте суть петиції"
        />
        <CharCounter value={title.length} max={ELECTION_TITLE_MAX_LENGTH} />
      </FormField>

      <FormField label="Опис" required htmlFor="description">
        <Textarea
          id="description"
          value={description}
          maxLength={ELECTION_DESCRIPTION_MAX_LENGTH}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Детально опишіть проблему та пропозицію"
          rows={8}
        />
        <CharCounter value={description.length} max={ELECTION_DESCRIPTION_MAX_LENGTH} />
      </FormField>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => router.back()} disabled={loading}>
          Скасувати
        </Button>
        <Button type="submit" variant="accent" loading={loading} disabled={!canSubmit}>
          Створити петицію
        </Button>
      </div>
    </form>
  );
}
