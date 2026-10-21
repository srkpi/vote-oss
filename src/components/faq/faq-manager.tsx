'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { CategoryCard } from '@/components/faq/category-card';
import {
  DeleteCategoryDialog,
  DeleteItemDialog,
  type DeleteItemTarget,
  RenameCategoryDialog,
} from '@/components/faq/category-dialogs';
import { CategoryTitleForm } from '@/components/faq/category-title-form';
import { FaqItemDialog } from '@/components/faq/faq-item-dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
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

  const [addingCategory, setAddingCategory] = useState(false);

  const [renameCategory, setRenameCategory] = useState<FaqCategoryData | null>(null);

  const [deleteCategory, setDeleteCategory] = useState<FaqCategoryData | null>(null);
  const [deleteCategoryLoading, setDeleteCategoryLoading] = useState(false);

  const [itemDialog, setItemDialog] = useState<ItemDialogState>({ open: false, categoryId: '' });
  const [itemLoading, setItemLoading] = useState(false);

  const [deleteItem, setDeleteItem] = useState<DeleteItemTarget | null>(null);
  const [deleteItemLoading, setDeleteItemLoading] = useState(false);

  const [categoryDragIndex, setCategoryDragIndex] = useState<number | null>(null);
  const [categoryDragOverIndex, setCategoryDragOverIndex] = useState<number | null>(null);

  // Keep a snapshot of categories before the drag so we can revert on API failure
  const categoriesBeforeDragRef = useRef<FaqCategoryData[]>([]);

  const err = (e: unknown) =>
    toast({
      title: 'Помилка',
      description: e instanceof Error ? e.message : String(e),
      variant: 'error',
    });

  const handleCreateCategory = async (title: string) => {
    const { data, error } = await api.faq.categories.create(title);
    if (error !== null) {
      throw new Error(error);
    }
    setCategories((prev) => [...prev, { ...data, items: [] }]);
    setAddingCategory(false);
    toast({ title: 'Категорію створено', variant: 'success' });
    router.refresh();
  };

  const handleRenameCategory = async (title: string) => {
    if (!renameCategory) {
      return;
    }
    const { error } = await api.faq.categories.update(renameCategory.id, title);
    if (error !== null) {
      throw new Error(error);
    }
    setCategories((prev) =>
      prev.map((category) =>
        category.id === renameCategory.id ? { ...category, title } : category,
      ),
    );
    setRenameCategory(null);
    toast({ title: 'Категорію оновлено', variant: 'success' });
    router.refresh();
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategory) {
      return;
    }

    setDeleteCategoryLoading(true);
    const { error } = await api.faq.categories.delete(deleteCategory.id);
    setDeleteCategoryLoading(false);

    if (error !== null) {
      err(error);
      return;
    }

    setCategories((prev) => prev.filter((category) => category.id !== deleteCategory.id));
    setDeleteCategory(null);
    toast({ title: 'Категорію видалено', variant: 'success' });
    router.refresh();
  };

  const moveCategory = async (index: number, direction: 'up' | 'down') => {
    const next = [...categories];
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    [next[index], next[swapWith]] = [next[swapWith], next[index]];

    setCategories(next);
    const { error } = await api.faq.categories.reorder(next.map((category) => category.id));
    if (error !== null) {
      setCategories(categories);
    }
  };

  const moveCategoryTo = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) {
      return;
    }

    const next = [...categories];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    const snapshot = categories;
    setCategories(next);
    const { error } = await api.faq.categories.reorder(next.map((category) => category.id));
    if (error !== null) {
      setCategories(snapshot);
    }
  };

  const handleCategoryDragStart = (index: number) => {
    categoriesBeforeDragRef.current = categories;
    setCategoryDragIndex(index);
  };

  const handleCategoryDragEnter = (index: number) => {
    setCategoryDragOverIndex(index);
  };

  const handleCategoryDragEnd = () => {
    setCategoryDragIndex(null);
    setCategoryDragOverIndex(null);
  };

  const handleCategoryDrop = (toIndex: number) => {
    if (categoryDragIndex === null) {
      handleCategoryDragEnd();
      return;
    }

    // Always insert before the hovered card — one unambiguous drop position per card
    let target = toIndex;
    if (categoryDragIndex < target) {
      target -= 1;
    }
    if (target !== categoryDragIndex) {
      moveCategoryTo(categoryDragIndex, target);
    }
    handleCategoryDragEnd();
  };

  const handleSaveItem = async (title: string, content: string) => {
    const { categoryId, item } = itemDialog;
    setItemLoading(true);

    if (item) {
      const { data, error } = await api.faq.items.update(item.id, title, content);
      setItemLoading(false);
      if (error !== null) {
        err(error);
        return;
      }

      setCategories((prev) =>
        prev.map((category) =>
          category.id === categoryId
            ? {
                ...category,
                items: category.items.map((i) => (i.id === item.id ? { ...i, ...data } : i)),
              }
            : category,
        ),
      );
      toast({ title: 'Пункт оновлено', variant: 'success' });
    } else {
      const { data, error } = await api.faq.items.create(categoryId, title, content);
      setItemLoading(false);
      if (error !== null) {
        err(error);
        return;
      }

      setCategories((prev) =>
        prev.map((category) =>
          category.id === categoryId ? { ...category, items: [...category.items, data] } : category,
        ),
      );
      toast({ title: 'Пункт створено', variant: 'success' });
    }

    setItemDialog({ open: false, categoryId: '' });
    router.refresh();
  };

  const handleDeleteItem = async () => {
    if (!deleteItem) {
      return;
    }

    setDeleteItemLoading(true);
    const { error } = await api.faq.items.delete(deleteItem.item.id);
    setDeleteItemLoading(false);

    if (error !== null) {
      err(error);
      return;
    }

    setCategories((prev) =>
      prev.map((category) =>
        category.id === deleteItem.categoryId
          ? { ...category, items: category.items.filter((i) => i.id !== deleteItem.item.id) }
          : category,
      ),
    );
    setDeleteItem(null);
    toast({ title: 'Пункт видалено', variant: 'success' });
    router.refresh();
  };

  const moveItem = async (categoryId: string, index: number, direction: 'up' | 'down') => {
    const category = categories.find((category) => category.id === categoryId);
    if (!category) {
      return;
    }

    const next = [...category.items];
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    [next[index], next[swapWith]] = [next[swapWith], next[index]];

    setCategories((prev) =>
      prev.map((category) =>
        category.id === categoryId ? { ...category, items: next } : category,
      ),
    );
    const { error } = await api.faq.items.reorder(
      categoryId,
      next.map((i) => i.id),
    );
    if (error !== null) {
      setCategories(categories);
    }
  };

  /** Arbitrary reorder (drag) */
  const moveItemTo = async (categoryId: string, fromIndex: number, toIndex: number) => {
    const category = categories.find((category) => category.id === categoryId);
    if (!category || fromIndex === toIndex) {
      return;
    }

    const next = [...category.items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    const snapshot = categories;
    setCategories((prev) =>
      prev.map((category) =>
        category.id === categoryId ? { ...category, items: next } : category,
      ),
    );
    const { error } = await api.faq.items.reorder(
      categoryId,
      next.map((i) => i.id),
    );
    if (error !== null) {
      setCategories(snapshot);
    }
  };

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

  return (
    <div className="space-y-4">
      {categories.map((category, categoryIndex) => (
        <CategoryCard
          key={category.id}
          category={category}
          isFirst={categoryIndex === 0}
          isLast={categoryIndex === categories.length - 1}
          isCollapsed={collapsed.has(category.id)}
          isDragging={categoryDragIndex === categoryIndex}
          isDragOver={categoryDragOverIndex === categoryIndex}
          onToggleCollapse={() => toggleCollapse(category.id)}
          onMoveUp={() => moveCategory(categoryIndex, 'up')}
          onMoveDown={() => moveCategory(categoryIndex, 'down')}
          onRename={() => setRenameCategory(category)}
          onDelete={() => setDeleteCategory(category)}
          onAddItem={() => setItemDialog({ open: true, categoryId: category.id })}
          onEditItem={(item) => setItemDialog({ open: true, categoryId: category.id, item })}
          onDeleteItem={(item) => setDeleteItem({ item, categoryId: category.id })}
          onMoveItemUp={(idx) => moveItem(category.id, idx, 'up')}
          onMoveItemDown={(idx) => moveItem(category.id, idx, 'down')}
          onMoveItemTo={(from, to) => moveItemTo(category.id, from, to)}
          onCategoryDragStart={() => handleCategoryDragStart(categoryIndex)}
          onCategoryDragEnter={() => handleCategoryDragEnter(categoryIndex)}
          onCategoryDragEnd={handleCategoryDragEnd}
          onCategoryDrop={() => handleCategoryDrop(categoryIndex)}
        />
      ))}

      {addingCategory ? (
        <div className="border-border-color bg-card shadow-card rounded-xl border p-4 sm:p-5">
          <p className="font-body text-foreground mb-3 text-sm font-semibold">Нова категорія</p>
          <CategoryTitleForm
            onSave={handleCreateCategory}
            onCancel={() => setAddingCategory(false)}
          />
        </div>
      ) : (
        <Button
          variant="secondary"
          size="md"
          onClick={() => setAddingCategory(true)}
          icon={<Plus className="h-4 w-4" />}
        >
          Додати категорію
        </Button>
      )}

      <RenameCategoryDialog
        category={renameCategory}
        onConfirm={handleRenameCategory}
        onClose={() => setRenameCategory(null)}
      />

      <DeleteCategoryDialog
        category={deleteCategory}
        onConfirm={handleDeleteCategory}
        onClose={() => setDeleteCategory(null)}
        loading={deleteCategoryLoading}
      />

      <FaqItemDialog
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
