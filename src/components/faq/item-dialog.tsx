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
import { draftToPlainText } from '@/lib/utils';

// Dynamically imported — Draft.js is browser-only
const DraftEditor = dynamic(() => import('@/components/ui/draft-editor'), {
  ssr: false,
  loading: () => (
    <div
      style={{ minHeight: '180px' }}
      className="border border-[var(--border-color)] rounded-[var(--radius)] bg-[var(--surface)] animate-pulse"
    />
  ),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ItemDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called when the user confirms. Returning a string signals an error. */
  onSave: (title: string, content: string) => Promise<void>;
  initial?: { title: string; content: string };
  loading: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ItemDialog({ open, onClose, onSave, initial, loading }: ItemDialogProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [error, setError] = useState<string | null>(null);
  const prevOpen = useRef(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open && !prevOpen.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(initial?.title ?? '');
      setContent(initial?.content ?? '');
      setError(null);
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

    // Measure plain-text length from the Draft.js JSON
    const plainLength = draftToPlainText(content).length;
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
            <DraftEditor
              value={content}
              onChange={setContent}
              placeholder="Введіть відповідь…"
              maxLength={FAQ_ITEM_CONTENT_MAX_LENGTH}
              minHeight="180px"
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
