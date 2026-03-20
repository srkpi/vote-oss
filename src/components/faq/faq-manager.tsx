'use client';

import { HelpCircle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { CategoryCard } from '@/components/faq/category-card';
import {
  DeleteCategoryDialog,
  DeleteItemDialog,
  type DeleteItemTarget,
  RenameCategoryDialog,
} from '@/components/faq/category-dialogs';
import { ItemDialog } from '@/components/faq/item-dialog';
import { Button } from '@/components/ui/button';
import { CharCounter } from '@/components/ui/char-counter';
import { Input } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import { FAQ_CATEGORY_TITLE_MAX_LENGTH } from '@/lib/constants';
import type { FaqCategoryData, FaqItemData } from '@/types/faq';

interface ItemDialogState {
  open: boolean;
  categoryId: string;
  item?: FaqItemData;
}

interface FaqManagerProps {
  initialCategories: FaqCategoryData[];
}

export function FaqManager({ initialCategories }: FaqManagerProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [categories, setCategories] = useState<FaqCategoryData[]>(initialCategories);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [addingCat, setAddingCat] = useState(false);
  const [newCatTitle, setNewCatTitle] = useState('');
  const [addingCatLoading, setAddingCatLoading] = useState(false);

  const [renameCat, setRenameCat] = useState<FaqCategoryData | null>(null);
  const [renameCatTitle, setRenameCatTitle] = useState('');
  const [renameCatLoading, setRenameCatLoading] = useState(false);

  const [deleteCat, setDeleteCat] = useState<FaqCategoryData | null>(null);
  const [deleteCatLoading, setDeleteCatLoading] = useState(false);

  const [itemDialog, setItemDialog] = useState<ItemDialogState>({ open: false, categoryId: '' });
  const [itemLoading, setItemLoading] = useState(false);

  const [deleteItem, setDeleteItem] = useState<DeleteItemTarget | null>(null);
  const [deleteItemLoading, setDeleteItemLoading] = useState(false);

  const err = (e: unknown) =>
    toast({
      title: 'Помилка',
      description: e instanceof Error ? e.message : String(e),
      variant: 'error',
    });

  const handleCreateCategory = async () => {
    const title = newCatTitle.trim();
    if (!title) return;

    setAddingCatLoading(true);
    const { data, error } = await api.createFaqCategory(title);
    setAddingCatLoading(false);

    if (error !== null) {
      err(error);
      return;
    }

    setCategories((prev) => [...prev, { ...data, items: [] }]);
    setNewCatTitle('');
    setAddingCat(false);
    toast({ title: 'Категорію створено', variant: 'success' });
    router.refresh();
  };

  const openRename = (cat: FaqCategoryData) => {
    setRenameCat(cat);
    setRenameCatTitle(cat.title);
  };

  const handleRenameCategory = async () => {
    if (!renameCat) return;
    const title = renameCatTitle.trim();
    if (!title) return;

    setRenameCatLoading(true);
    const { error } = await api.updateFaqCategory(renameCat.id, title);
    setRenameCatLoading(false);

    if (error !== null) {
      err(error);
      return;
    }

    setCategories((prev) => prev.map((c) => (c.id === renameCat.id ? { ...c, title } : c)));
    setRenameCat(null);
    toast({ title: 'Категорію оновлено', variant: 'success' });
    router.refresh();
  };

  const handleDeleteCategory = async () => {
    if (!deleteCat) return;

    setDeleteCatLoading(true);
    const { error } = await api.deleteFaqCategory(deleteCat.id);
    setDeleteCatLoading(false);

    if (error !== null) {
      err(error);
      return;
    }

    setCategories((prev) => prev.filter((c) => c.id !== deleteCat.id));
    setDeleteCat(null);
    toast({ title: 'Категорію видалено', variant: 'success' });
    router.refresh();
  };

  const moveCategory = async (index: number, direction: 'up' | 'down') => {
    const next = [...categories];
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    [next[index], next[swapWith]] = [next[swapWith], next[index]];

    setCategories(next); // optimistic
    const { error } = await api.reorderFaqCategories(next.map((c) => c.id));
    if (error !== null) setCategories(categories); // revert on failure
  };

  const handleSaveItem = async (title: string, content: string) => {
    const { categoryId, item } = itemDialog;
    setItemLoading(true);

    if (item) {
      const { data, error } = await api.updateFaqItem(item.id, title, content);
      setItemLoading(false);
      if (error !== null) {
        err(error);
        return;
      }

      setCategories((prev) =>
        prev.map((c) =>
          c.id === categoryId
            ? { ...c, items: c.items.map((i) => (i.id === item.id ? { ...i, ...data } : i)) }
            : c,
        ),
      );
      toast({ title: 'Пункт оновлено', variant: 'success' });
    } else {
      const { data, error } = await api.createFaqItem(categoryId, title, content);
      setItemLoading(false);
      if (error !== null) {
        err(error);
        return;
      }

      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, items: [...c.items, data] } : c)),
      );
      toast({ title: 'Пункт створено', variant: 'success' });
    }

    setItemDialog({ open: false, categoryId: '' });
    router.refresh();
  };

  const handleDeleteItem = async () => {
    if (!deleteItem) return;

    setDeleteItemLoading(true);
    const { error } = await api.deleteFaqItem(deleteItem.item.id);
    setDeleteItemLoading(false);

    if (error !== null) {
      err(error);
      return;
    }

    setCategories((prev) =>
      prev.map((c) =>
        c.id === deleteItem.categoryId
          ? { ...c, items: c.items.filter((i) => i.id !== deleteItem.item.id) }
          : c,
      ),
    );
    setDeleteItem(null);
    toast({ title: 'Пункт видалено', variant: 'success' });
    router.refresh();
  };

  const moveItem = async (categoryId: string, index: number, direction: 'up' | 'down') => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;

    const next = [...cat.items];
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    [next[index], next[swapWith]] = [next[swapWith], next[index]];

    setCategories((prev) => prev.map((c) => (c.id === categoryId ? { ...c, items: next } : c)));
    const { error } = await api.reorderFaqItems(
      categoryId,
      next.map((i) => i.id),
    );
    if (error !== null) setCategories(categories); // revert
  };

  // ── Collapse ──────────────────────────────────────────────────────────────

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Category list */}
      {categories.map((cat, catIdx) => (
        <CategoryCard
          key={cat.id}
          category={cat}
          isFirst={catIdx === 0}
          isLast={catIdx === categories.length - 1}
          isCollapsed={collapsed.has(cat.id)}
          onToggleCollapse={() => toggleCollapse(cat.id)}
          onMoveUp={() => moveCategory(catIdx, 'up')}
          onMoveDown={() => moveCategory(catIdx, 'down')}
          onRename={() => openRename(cat)}
          onDelete={() => setDeleteCat(cat)}
          onAddItem={() => setItemDialog({ open: true, categoryId: cat.id })}
          onEditItem={(item) => setItemDialog({ open: true, categoryId: cat.id, item })}
          onDeleteItem={(item) => setDeleteItem({ item, categoryId: cat.id })}
          onMoveItemUp={(idx) => moveItem(cat.id, idx, 'up')}
          onMoveItemDown={(idx) => moveItem(cat.id, idx, 'down')}
        />
      ))}

      {/* Add category */}
      {addingCat ? (
        <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] p-4 sm:p-5">
          <p className="text-sm font-semibold font-body text-[var(--foreground)] mb-3">
            Нова категорія
          </p>
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-1">
              <Input
                value={newCatTitle}
                onChange={(e) => setNewCatTitle(e.target.value)}
                placeholder="Назва категорії"
                error={newCatTitle.length > FAQ_CATEGORY_TITLE_MAX_LENGTH}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateCategory();
                  if (e.key === 'Escape') {
                    setAddingCat(false);
                    setNewCatTitle('');
                  }
                }}
              />
              <div className="flex justify-end">
                <CharCounter value={newCatTitle} max={FAQ_CATEGORY_TITLE_MAX_LENGTH} />
              </div>
            </div>
            <Button
              variant="accent"
              size="md"
              onClick={handleCreateCategory}
              loading={addingCatLoading}
            >
              Додати
            </Button>
            <button
              type="button"
              onClick={() => {
                setAddingCat(false);
                setNewCatTitle('');
              }}
              className="w-9 h-10 flex items-center justify-center rounded-[var(--radius)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          size="md"
          onClick={() => setAddingCat(true)}
          icon={<HelpCircle className="w-4 h-4" />}
        >
          Додати категорію
        </Button>
      )}

      <RenameCategoryDialog
        category={renameCat}
        title={renameCatTitle}
        onTitleChange={setRenameCatTitle}
        onConfirm={handleRenameCategory}
        onClose={() => setRenameCat(null)}
        loading={renameCatLoading}
      />

      <DeleteCategoryDialog
        category={deleteCat}
        onConfirm={handleDeleteCategory}
        onClose={() => setDeleteCat(null)}
        loading={deleteCatLoading}
      />

      <ItemDialog
        open={itemDialog.open}
        onClose={() => setItemDialog({ open: false, categoryId: '' })}
        onSave={handleSaveItem}
        initial={
          itemDialog.item
            ? { title: itemDialog.item.title, content: itemDialog.item.content }
            : undefined
        }
        loading={itemLoading}
      />

      <DeleteItemDialog
        target={deleteItem}
        onConfirm={handleDeleteItem}
        onClose={() => setDeleteItem(null)}
        loading={deleteItemLoading}
      />
    </div>
  );
}
