'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import dynamic from 'next/dynamic';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CharCounter } from '@/components/ui/char-counter';
import {
  Dialog,
  DialogBody,
  DialogCloseButton,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField, Input } from '@/components/ui/form';
import { FAQ_ITEM_CONTENT_MAX_LENGTH, FAQ_ITEM_TITLE_MAX_LENGTH } from '@/lib/constants';
import { faqItemBodySchema } from '@/lib/schemas/faq';

// Quill is browser-only
const QuillEditor = dynamic(() => import('@/components/ui/quill/quill-editor'), {
  ssr: false,
  loading: () => (
    <div
      style={{ minHeight: '180px' }}
      className="border-border-color bg-surface animate-pulse rounded-(--radius) border"
    />
  ),
});

export interface FaqItemDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (title: string, content: string) => Promise<void>;
  initial?: { title: string; content: string };
  loading: boolean;
}

export function FaqItemDialog({ open, onClose, onSave, initial, loading }: FaqItemDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      {/* Dialog unmounts its children on close, resetting both the form and Quill. */}
      <FaqItemForm onClose={onClose} onSave={onSave} initial={initial} loading={loading} />
    </Dialog>
  );
}

function FaqItemForm({ onClose, onSave, initial, loading }: Omit<FaqItemDialogProps, 'open'>) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof faqItemBodySchema>>({
    resolver: zodResolver(faqItemBodySchema),
    defaultValues: { title: initial?.title ?? '', content: initial?.content ?? '' },
  });
  const title = useWatch({ control, name: 'title' });
  const isSaving = loading || isSubmitting;

  const handleSave = handleSubmit(async (values) => {
    try {
      await onSave(values.title, values.content);
    } catch {
      setError('root', { message: 'Не вдалося зберегти пункт FAQ. Спробуйте ще раз.' });
    }
  });

  const isEditing = !!initial;

  return (
    <DialogPanel maxWidth="lg">
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Редагувати пункт' : 'Новий пункт FAQ'}</DialogTitle>
        <DialogCloseButton onClose={onClose} />
      </DialogHeader>

      <form
        noValidate
        className="contents"
        onSubmit={(event) => {
          if (isSaving) {
            event.preventDefault();
            return;
          }
          void handleSave(event);
        }}
      >
        <DialogBody className="space-y-4">
          {errors.root && (
            <Alert variant="error" onDismiss={() => clearErrors('root')}>
              {errors.root.message}
            </Alert>
          )}

          <FormField
            label="Заголовок"
            required
            htmlFor="item-title"
            error={
              errors.title
                ? `Вкажіть заголовок до ${FAQ_ITEM_TITLE_MAX_LENGTH} символів`
                : undefined
            }
          >
            <div className="space-y-1">
              <Input
                id="item-title"
                {...register('title')}
                placeholder="Як проголосувати?"
                error={!!errors.title || title.trim().length > FAQ_ITEM_TITLE_MAX_LENGTH}
                disabled={isSaving}
              />
              <div className="flex justify-end">
                <CharCounter value={title} max={FAQ_ITEM_TITLE_MAX_LENGTH} />
              </div>
            </div>
          </FormField>

          <FormField
            label="Відповідь"
            required
            error={
              errors.content
                ? `Вкажіть коректну відповідь до ${FAQ_ITEM_CONTENT_MAX_LENGTH} символів`
                : undefined
            }
          >
            <Controller
              name="content"
              control={control}
              render={({ field, fieldState }) => (
                <div onBlur={field.onBlur}>
                  <QuillEditor
                    value={field.value}
                    onChange={field.onChange}
                    error={!!fieldState.error}
                    placeholder="Введіть відповідь…"
                    maxLength={FAQ_ITEM_CONTENT_MAX_LENGTH}
                    minHeight="180px"
                    maxHeight="300px"
                  />
                </div>
              )}
            />
          </FormField>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Скасувати
          </Button>
          <Button type="submit" variant="accent" loading={isSaving}>
            Зберегти
          </Button>
        </DialogFooter>
      </form>
    </DialogPanel>
  );
}
