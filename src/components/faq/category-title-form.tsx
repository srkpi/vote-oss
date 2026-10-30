'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CharCounter } from '@/components/ui/char-counter';
import { DialogBody, DialogFooter } from '@/components/ui/dialog';
import { FormField, Input } from '@/components/ui/form';
import { FAQ_CATEGORY_TITLE_MAX_LENGTH } from '@/lib/constants';
import { faqCategoryBodySchema } from '@/lib/schemas/faq';

interface CategoryTitleFormProps {
  initialTitle?: string;
  onSave: (title: string) => Promise<void>;
  onCancel: () => void;
  inDialog?: boolean;
}

export function CategoryTitleForm({
  initialTitle = '',
  onSave,
  onCancel,
  inDialog = false,
}: CategoryTitleFormProps) {
  const inputId = useId();
  const {
    register,
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof faqCategoryBodySchema>>({
    resolver: zodResolver(faqCategoryBodySchema),
    defaultValues: { title: initialTitle },
  });
  const title = useWatch({ control, name: 'title' });
  const save = handleSubmit(async (values) => {
    try {
      await onSave(values.title);
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Не вдалося зберегти категорію',
      });
    }
  });
  const Body = inDialog ? DialogBody : 'div';
  const Footer = inDialog ? DialogFooter : 'div';

  return (
    <form noValidate onSubmit={save} className={inDialog ? 'contents' : 'flex items-start gap-2'}>
      <Body className="min-w-0 flex-1 space-y-2">
        {errors.root && (
          <Alert variant="error" onDismiss={() => clearErrors('root')}>
            {errors.root.message}
          </Alert>
        )}
        <FormField
          htmlFor={inputId}
          error={
            errors.title ? `Вкажіть назву до ${FAQ_CATEGORY_TITLE_MAX_LENGTH} символів` : undefined
          }
        >
          <Input
            id={inputId}
            {...register('title')}
            placeholder="Назва категорії"
            error={!!errors.title || title.length > FAQ_CATEGORY_TITLE_MAX_LENGTH}
            disabled={isSubmitting}
            autoFocus
            onKeyDown={(event) => {
              if (!inDialog && event.key === 'Escape' && !isSubmitting) {
                onCancel();
              }
            }}
          />
          <div className="flex justify-end">
            <CharCounter value={title} max={FAQ_CATEGORY_TITLE_MAX_LENGTH} />
          </div>
        </FormField>
      </Body>
      <Footer className={inDialog ? undefined : 'flex gap-2'}>
        {inDialog && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Скасувати
          </Button>
        )}
        <Button type="submit" variant="accent" loading={isSubmitting}>
          {inDialog ? 'Зберегти' : 'Додати'}
        </Button>
        {!inDialog && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </Footer>
    </form>
  );
}
