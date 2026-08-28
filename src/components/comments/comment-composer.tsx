'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { CharCounter } from '@/components/ui/char-counter';
import { Textarea } from '@/components/ui/form';
import { useAutoResizeTextarea } from '@/hooks/use-auto-resize-textarea';
import { useToast } from '@/hooks/use-toast';
import { COMMENT_MAX_LENGTH } from '@/lib/constants';

interface CommentComposerProps {
  initialValue?: string;
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  maxLength?: number;
  disabled?: boolean;
  onCancel?: () => void;
  onSubmit: (body: string) => Promise<void>;
}

export function CommentComposer({
  initialValue = '',
  placeholder = 'Ваш коментар…',
  submitLabel = 'Надіслати',
  autoFocus = false,
  maxLength = COMMENT_MAX_LENGTH,
  disabled = false,
  onCancel,
  onSubmit,
}: CommentComposerProps) {
  const [value, setValue] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const textareaRef = useAutoResizeTextarea(value);

  const trimmed = value.trim();
  const isValid = trimmed.length > 0 && value.length <= maxLength;
  const isLocked = submitting || disabled;

  const handleSubmit = async () => {
    if (!isValid || isLocked) return;
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
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          rows={3}
          autoFocus={autoFocus}
          disabled={isLocked}
          className="max-h-112 resize-none overflow-y-auto"
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
                disabled={isLocked}
              >
                Скасувати
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={!isValid || isLocked}
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
