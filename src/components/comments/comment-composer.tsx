'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { CharCounter } from '@/components/ui/char-counter';
import { Textarea } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { COMMENT_MAX_LENGTH } from '@/lib/constants';

interface CommentComposerProps {
  initialValue?: string;
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  maxLength?: number;
  onCancel?: () => void;
  onSubmit: (body: string) => Promise<void>;
}

export function CommentComposer({
  initialValue = '',
  placeholder = 'Ваш коментар…',
  submitLabel = 'Надіслати',
  autoFocus = false,
  maxLength = COMMENT_MAX_LENGTH,
  onCancel,
  onSubmit,
}: CommentComposerProps) {
  const [value, setValue] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const trimmed = value.trim();
  const isValid = trimmed.length > 0 && value.length <= maxLength;

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setValue('');
    } catch (err) {
      toast({
        title: 'Не вдалося зберегти',
        description: err instanceof Error ? err.message : 'Спробуйте ще раз',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex gap-3">
      <div className="min-w-0 flex-1 space-y-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          rows={3}
          autoFocus={autoFocus}
          disabled={submitting}
          className="resize-none"
        />
        <div className="flex items-center justify-between gap-3">
          <CharCounter value={value} max={maxLength} />
          <div className="flex gap-2">
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancel}
                disabled={submitting}
              >
                Скасувати
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={!isValid || submitting}
              loading={submitting}
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
