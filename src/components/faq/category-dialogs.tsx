'use client';

import { CategoryTitleForm } from '@/components/faq/category-title-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogCloseButton,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from '@/components/ui/dialog';
import type { FaqCategoryData, FaqItemData } from '@/types/faq';

export interface RenameCategoryDialogProps {
  category: FaqCategoryData | null;
  onConfirm: (title: string) => Promise<void>;
  onClose: () => void;
}

export function RenameCategoryDialog({ category, onConfirm, onClose }: RenameCategoryDialogProps) {
  return (
    <Dialog open={!!category} onClose={onClose}>
      <DialogPanel maxWidth="sm">
        <DialogHeader>
          <DialogTitle>Перейменувати категорію</DialogTitle>
          <DialogCloseButton onClose={onClose} />
        </DialogHeader>
        <CategoryTitleForm
          key={category?.id}
          initialTitle={category?.title}
          onSave={onConfirm}
          onCancel={onClose}
          inDialog
        />
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
