'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

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
import { deltaToPlainText } from '@/lib/utils/common';

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
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [error, setError] = useState<string | null>(null);

  // Incremented every time the dialog opens to force QuillEditor to remount,
  // which guarantees its internal Quill state is fully reset.
  const [editorKey, setEditorKey] = useState(0);
  const prevOpen = useRef(false);

  useEffect(() => {
    if (open && !prevOpen.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(initial?.title ?? '');
      setContent(initial?.content ?? '');
      setError(null);
      setEditorKey((k) => k + 1);
    }
    prevOpen.current = open;
  }, [open, initial]);

  const handleSave = async () => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError("Заголовок обов'язковий");
      return;
    }
    if (trimmedTitle.length > FAQ_ITEM_TITLE_MAX_LENGTH) {
      setError(`Заголовок — максимум ${FAQ_ITEM_TITLE_MAX_LENGTH} символів`);
      return;
    }

    // Measure plain-text length from the Delta JSON
    const plainLength = deltaToPlainText(content).length;
    if (plainLength > FAQ_ITEM_CONTENT_MAX_LENGTH) {
      setError(`Текст відповіді — максимум ${FAQ_ITEM_CONTENT_MAX_LENGTH} символів`);
      return;
    }

    setError(null);
    await onSave(trimmedTitle, content);
  };

  const isEditing = !!initial;

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogPanel maxWidth="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Редагувати пункт' : 'Новий пункт FAQ'}</DialogTitle>
          <DialogCloseButton onClose={onClose} />
        </DialogHeader>

        <DialogBody className="space-y-4">
          {error && (
            <Alert variant="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          <FormField label="Заголовок" required htmlFor="item-title">
            <div className="space-y-1">
              <Input
                id="item-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Як проголосувати?"
                error={title.trim().length > FAQ_ITEM_TITLE_MAX_LENGTH}
              />
              <div className="flex justify-end">
                <CharCounter value={title} max={FAQ_ITEM_TITLE_MAX_LENGTH} />
              </div>
            </div>
          </FormField>

          <FormField label="Відповідь" required>
            <QuillEditor
              key={editorKey}
              value={content}
              onChange={setContent}
              placeholder="Введіть відповідь…"
              maxLength={FAQ_ITEM_CONTENT_MAX_LENGTH}
              minHeight="180px"
              maxHeight="300px"
            />
          </FormField>
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Скасувати
          </Button>
          <Button variant="accent" onClick={handleSave} loading={loading}>
            Зберегти
          </Button>
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
}
