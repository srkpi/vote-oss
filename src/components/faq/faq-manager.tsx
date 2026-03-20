/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import {
  ChevronDown,
  ChevronUp,
  Edit2,
  GripVertical,
  HelpCircle,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import type { FaqCategoryData, FaqItemData } from '@/components/faq/faq-accordion';
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
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { useToast } from '@/hooks/use-toast';
import {
  FAQ_CATEGORY_TITLE_MAX_LENGTH,
  FAQ_ITEM_CONTENT_MAX_LENGTH,
  FAQ_ITEM_TITLE_MAX_LENGTH,
} from '@/lib/constants';
import { cn } from '@/lib/utils';

interface FaqManagerProps {
  initialCategories: FaqCategoryData[];
}

// ---------------------------------------------------------------------------
// Item form dialog
// ---------------------------------------------------------------------------

interface ItemDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (title: string, content: string) => Promise<void>;
  initial?: { title: string; content: string };
  loading: boolean;
}

function ItemDialog({ open, onClose, onSave, initial, loading }: ItemDialogProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [error, setError] = useState<string | null>(null);

  // Reset when opening
  const prevOpen = useRef(false);

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
    if (!title.trim()) {
      setError("Заголовок обов'язковий");
      return;
    }
    if (title.trim().length > FAQ_ITEM_TITLE_MAX_LENGTH) {
      setError(`Заголовок — максимум ${FAQ_ITEM_TITLE_MAX_LENGTH} символів`);
      return;
    }
    const plainLen = new DOMParser().parseFromString(content, 'text/html').body.innerText.length;
    if (plainLen > FAQ_ITEM_CONTENT_MAX_LENGTH) {
      setError(`Текст — максимум ${FAQ_ITEM_CONTENT_MAX_LENGTH} символів`);
      return;
    }
    setError(null);
    await onSave(title.trim(), content);
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogPanel maxWidth="lg">
        <DialogHeader>
          <DialogTitle>{initial ? 'Редагувати пункт' : 'Новий пункт FAQ'}</DialogTitle>
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
          <FormField label="Відповідь" required htmlFor="item-content">
            <RichTextEditor
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

// ---------------------------------------------------------------------------
// Main manager
// ---------------------------------------------------------------------------

export function FaqManager({ initialCategories }: FaqManagerProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [categories, setCategories] = useState<FaqCategoryData[]>(initialCategories);

  // Category creation
  const [newCatTitle, setNewCatTitle] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [catLoading, setCatLoading] = useState(false);

  // Category rename
  const [renameCat, setRenameCat] = useState<FaqCategoryData | null>(null);
  const [renameCatTitle, setRenameCatTitle] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  // Category delete
  const [deleteCat, setDeleteCat] = useState<FaqCategoryData | null>(null);
  const [deleteCatLoading, setDeleteCatLoading] = useState(false);

  // Item create/edit
  const [itemDialog, setItemDialog] = useState<{
    open: boolean;
    categoryId: string;
    item?: FaqItemData;
  }>({ open: false, categoryId: '' });
  const [itemLoading, setItemLoading] = useState(false);

  // Item delete
  const [deleteItem, setDeleteItem] = useState<{ item: FaqItemData; categoryId: string } | null>(
    null,
  );
  const [deleteItemLoading, setDeleteItemLoading] = useState(false);

  // Collapsed categories
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // ── Helpers ──────────────────────────────────────────────────────────────

  const apiCall = async (url: string, opts: RequestInit) => {
    const res = await fetch(url, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as any).message ?? `HTTP ${res.status}`);
    }
    return res.json();
  };

  // ── Category actions ──────────────────────────────────────────────────────

  const handleCreateCategory = async () => {
    if (!newCatTitle.trim()) return;
    setCatLoading(true);
    try {
      const created = await apiCall('/api/faq', {
        method: 'POST',
        body: JSON.stringify({ title: newCatTitle.trim() }),
      });
      setCategories((prev) => [...prev, { ...created, items: [] }]);
      setNewCatTitle('');
      setAddingCat(false);
      toast({ title: 'Категорію створено', variant: 'success' });
      router.refresh();
    } catch (e: any) {
      toast({ title: 'Помилка', description: e.message, variant: 'error' });
    } finally {
      setCatLoading(false);
    }
  };

  const handleRenameCategory = async () => {
    if (!renameCat || !renameCatTitle.trim()) return;
    setRenameLoading(true);
    try {
      await apiCall(`/api/faq/categories/${renameCat.id}`, {
        method: 'PUT',
        body: JSON.stringify({ title: renameCatTitle.trim() }),
      });
      setCategories((prev) =>
        prev.map((c) => (c.id === renameCat.id ? { ...c, title: renameCatTitle.trim() } : c)),
      );
      setRenameCat(null);
      toast({ title: 'Категорію оновлено', variant: 'success' });
      router.refresh();
    } catch (e: any) {
      toast({ title: 'Помилка', description: e.message, variant: 'error' });
    } finally {
      setRenameLoading(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCat) return;
    setDeleteCatLoading(true);
    try {
      await apiCall(`/api/faq/categories/${deleteCat.id}`, { method: 'DELETE' });
      setCategories((prev) => prev.filter((c) => c.id !== deleteCat.id));
      setDeleteCat(null);
      toast({ title: 'Категорію видалено', variant: 'success' });
      router.refresh();
    } catch (e: any) {
      toast({ title: 'Помилка', description: e.message, variant: 'error' });
    } finally {
      setDeleteCatLoading(false);
    }
  };

  const moveCategoryUp = async (index: number) => {
    if (index === 0) return;
    const newOrder = [...categories];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setCategories(newOrder);
    try {
      await apiCall('/api/faq/categories/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ order: newOrder.map((c) => c.id) }),
      });
    } catch {
      setCategories(categories); // revert
    }
  };

  const moveCategoryDown = async (index: number) => {
    if (index === categories.length - 1) return;
    const newOrder = [...categories];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setCategories(newOrder);
    try {
      await apiCall('/api/faq/categories/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ order: newOrder.map((c) => c.id) }),
      });
    } catch {
      setCategories(categories);
    }
  };

  // ── Item actions ──────────────────────────────────────────────────────────

  const handleSaveItem = async (title: string, content: string) => {
    const { categoryId, item } = itemDialog;
    setItemLoading(true);
    try {
      if (item) {
        // Update
        const updated = await apiCall(`/api/faq/items/${item.id}`, {
          method: 'PUT',
          body: JSON.stringify({ title, content }),
        });
        setCategories((prev) =>
          prev.map((c) =>
            c.id === categoryId
              ? { ...c, items: c.items.map((i) => (i.id === item.id ? { ...i, ...updated } : i)) }
              : c,
          ),
        );
        toast({ title: 'Пункт оновлено', variant: 'success' });
      } else {
        // Create
        const created = await apiCall(`/api/faq/categories/${categoryId}/items`, {
          method: 'POST',
          body: JSON.stringify({ title, content }),
        });
        setCategories((prev) =>
          prev.map((c) => (c.id === categoryId ? { ...c, items: [...c.items, created] } : c)),
        );
        toast({ title: 'Пункт створено', variant: 'success' });
      }
      setItemDialog({ open: false, categoryId: '' });
      router.refresh();
    } catch (e: any) {
      toast({ title: 'Помилка', description: e.message, variant: 'error' });
    } finally {
      setItemLoading(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteItem) return;
    setDeleteItemLoading(true);
    try {
      await apiCall(`/api/faq/items/${deleteItem.item.id}`, { method: 'DELETE' });
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
    } catch (e: any) {
      toast({ title: 'Помилка', description: e.message, variant: 'error' });
    } finally {
      setDeleteItemLoading(false);
    }
  };

  const moveItemUp = async (categoryId: string, index: number) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat || index === 0) return;
    const newItems = [...cat.items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    setCategories((prev) => prev.map((c) => (c.id === categoryId ? { ...c, items: newItems } : c)));
    try {
      await apiCall(`/api/faq/categories/${categoryId}/items/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ order: newItems.map((i) => i.id) }),
      });
    } catch {
      setCategories(categories);
    }
  };

  const moveItemDown = async (categoryId: string, index: number) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat || index === cat.items.length - 1) return;
    const newItems = [...cat.items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    setCategories((prev) => prev.map((c) => (c.id === categoryId ? { ...c, items: newItems } : c)));
    try {
      await apiCall(`/api/faq/categories/${categoryId}/items/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ order: newItems.map((i) => i.id) }),
      });
    } catch {
      setCategories(categories);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Categories */}
      {categories.map((cat, catIdx) => {
        const isCollapsed = collapsed.has(cat.id);
        return (
          <div
            key={cat.id}
            className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden"
          >
            {/* Category header */}
            <div className="flex items-center gap-2 px-4 sm:px-5 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--surface)]">
              <GripVertical className="w-4 h-4 text-[var(--kpi-gray-light)] shrink-0" />

              <button
                type="button"
                onClick={() =>
                  setCollapsed((s) => {
                    const n = new Set(s);
                    if (n.has(cat.id)) {
                      n.delete(cat.id);
                    } else {
                      n.add(cat.id);
                    }
                    return n;
                  })
                }
                className="flex-1 text-left font-display text-base font-semibold text-[var(--foreground)] hover:text-[var(--kpi-navy)] transition-colors"
              >
                {cat.title}
                <span className="ml-2 text-xs font-body font-normal text-[var(--muted-foreground)]">
                  ({cat.items.length})
                </span>
              </button>

              {/* Reorder buttons */}
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => moveCategoryUp(catIdx)}
                  disabled={catIdx === 0}
                  className="w-7 h-7 flex items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30 transition-colors"
                  title="Вгору"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveCategoryDown(catIdx)}
                  disabled={catIdx === categories.length - 1}
                  className="w-7 h-7 flex items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30 transition-colors"
                  title="Вниз"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setRenameCat(cat);
                  setRenameCatTitle(cat.title);
                }}
                className="w-7 h-7 flex items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
                title="Перейменувати"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setDeleteCat(cat)}
                className="w-7 h-7 flex items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors"
                title="Видалити"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Items */}
            {!isCollapsed && (
              <div className="divide-y divide-[var(--border-subtle)]">
                {cat.items.map((item, itemIdx) => (
                  <div key={item.id} className="flex items-start gap-2 px-4 sm:px-5 py-3 group">
                    <GripVertical className="w-4 h-4 text-[var(--kpi-gray-light)] shrink-0 mt-0.5" />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-body font-medium text-[var(--foreground)] leading-snug">
                        {item.title}
                      </p>
                      <div
                        className={cn(
                          'text-xs text-[var(--muted-foreground)] mt-0.5 line-clamp-1',
                          '[&_*]:inline',
                        )}
                        dangerouslySetInnerHTML={{ __html: item.content }}
                      />
                    </div>

                    {/* Item reorder */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => moveItemUp(cat.id, itemIdx)}
                        disabled={itemIdx === 0}
                        className="w-6 h-6 flex items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItemDown(cat.id, itemIdx)}
                        disabled={itemIdx === cat.items.length - 1}
                        className="w-6 h-6 flex items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemDialog({ open: true, categoryId: cat.id, item })}
                        className="w-6 h-6 flex items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteItem({ item, categoryId: cat.id })}
                        className="w-6 h-6 flex items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--error)]"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add item */}
                <div className="px-4 sm:px-5 py-2.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setItemDialog({ open: true, categoryId: cat.id })}
                    icon={<Plus className="w-3.5 h-3.5" />}
                    className="text-[var(--kpi-blue-light)] hover:bg-[var(--info-bg)]"
                  >
                    Додати пункт
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}

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
            <Button variant="accent" size="md" onClick={handleCreateCategory} loading={catLoading}>
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

      {/* Rename category dialog */}
      <Dialog open={!!renameCat} onClose={() => setRenameCat(null)}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Перейменувати категорію</DialogTitle>
            <DialogCloseButton onClose={() => setRenameCat(null)} />
          </DialogHeader>
          <DialogBody>
            <div className="space-y-1">
              <Input
                value={renameCatTitle}
                onChange={(e) => setRenameCatTitle(e.target.value)}
                error={renameCatTitle.length > FAQ_CATEGORY_TITLE_MAX_LENGTH}
                onKeyDown={(e) => e.key === 'Enter' && handleRenameCategory()}
                autoFocus
              />
              <div className="flex justify-end">
                <CharCounter value={renameCatTitle} max={FAQ_CATEGORY_TITLE_MAX_LENGTH} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRenameCat(null)} disabled={renameLoading}>
              Скасувати
            </Button>
            <Button variant="accent" onClick={handleRenameCategory} loading={renameLoading}>
              Зберегти
            </Button>
          </DialogFooter>
        </DialogPanel>
      </Dialog>

      {/* Delete category confirm */}
      <Dialog open={!!deleteCat} onClose={() => setDeleteCat(null)}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Видалити категорію?</DialogTitle>
            <DialogCloseButton onClose={() => setDeleteCat(null)} />
          </DialogHeader>
          <DialogBody>
            <Alert variant="warning">
              Категорія <strong>«{deleteCat?.title}»</strong> та всі її пункти будуть видалені. Цю
              дію неможливо скасувати.
            </Alert>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDeleteCat(null)}
              disabled={deleteCatLoading}
            >
              Скасувати
            </Button>
            <Button variant="danger" onClick={handleDeleteCategory} loading={deleteCatLoading}>
              Видалити
            </Button>
          </DialogFooter>
        </DialogPanel>
      </Dialog>

      {/* Item create/edit dialog */}
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

      {/* Delete item confirm */}
      <Dialog open={!!deleteItem} onClose={() => setDeleteItem(null)}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Видалити пункт?</DialogTitle>
            <DialogCloseButton onClose={() => setDeleteItem(null)} />
          </DialogHeader>
          <DialogBody>
            <Alert variant="warning">
              Пункт <strong>«{deleteItem?.item.title}»</strong> буде видалено назавжди.
            </Alert>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDeleteItem(null)}
              disabled={deleteItemLoading}
            >
              Скасувати
            </Button>
            <Button variant="danger" onClick={handleDeleteItem} loading={deleteItemLoading}>
              Видалити
            </Button>
          </DialogFooter>
        </DialogPanel>
      </Dialog>
    </div>
  );
}
