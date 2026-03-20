'use client';

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
import { Input } from '@/components/ui/form';
import { FAQ_CATEGORY_TITLE_MAX_LENGTH } from '@/lib/constants';
import type { FaqCategoryData, FaqItemData } from '@/types/faq';

export interface RenameCategoryDialogProps {
  category: FaqCategoryData | null;
  title: string;
  onTitleChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}

export function RenameCategoryDialog({
  category,
  title,
  onTitleChange,
  onConfirm,
  onClose,
  loading,
}: RenameCategoryDialogProps) {
  return (
    <Dialog open={!!category} onClose={onClose}>
      <DialogPanel maxWidth="sm">
        <DialogHeader>
          <DialogTitle>Перейменувати категорію</DialogTitle>
          <DialogCloseButton onClose={onClose} />
        </DialogHeader>
        <DialogBody>
          <div className="space-y-1">
            <Input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              error={title.length > FAQ_CATEGORY_TITLE_MAX_LENGTH}
              onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
              autoFocus
            />
            <div className="flex justify-end">
              <CharCounter value={title} max={FAQ_CATEGORY_TITLE_MAX_LENGTH} />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Скасувати
          </Button>
          <Button variant="accent" onClick={onConfirm} loading={loading}>
            Зберегти
          </Button>
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
}

export interface DeleteCategoryDialogProps {
  category: FaqCategoryData | null;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}

export function DeleteCategoryDialog({
  category,
  onConfirm,
  onClose,
  loading,
}: DeleteCategoryDialogProps) {
  return (
    <Dialog open={!!category} onClose={onClose}>
      <DialogPanel maxWidth="sm">
        <DialogHeader>
          <DialogTitle>Видалити категорію?</DialogTitle>
          <DialogCloseButton onClose={onClose} />
        </DialogHeader>
        <DialogBody>
          <Alert variant="warning">
            Категорія <strong className="wrap-break-word">«{category?.title}»</strong> та всі її
            пункти будуть видалені. Цю дію неможливо скасувати.
          </Alert>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Скасувати
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            Видалити
          </Button>
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
}

export interface DeleteItemTarget {
  item: FaqItemData;
  categoryId: string;
}

export interface DeleteItemDialogProps {
  target: DeleteItemTarget | null;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}

export function DeleteItemDialog({ target, onConfirm, onClose, loading }: DeleteItemDialogProps) {
  return (
    <Dialog open={!!target} onClose={onClose}>
      <DialogPanel maxWidth="sm">
        <DialogHeader>
          <DialogTitle>Видалити пункт?</DialogTitle>
          <DialogCloseButton onClose={onClose} />
        </DialogHeader>
        <DialogBody>
          <Alert variant="warning">
            Пункт <strong className="wrap-break-word">«{target?.item.title}»</strong> буде видалено
            назавжди.
          </Alert>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Скасувати
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            Видалити
          </Button>
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
}
