'use client';

import { ChevronDown, ChevronUp, Edit2, GripVertical, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { draftToPlainText } from '@/lib/utils';
import type { FaqCategoryData, FaqItemData } from '@/types/faq';

// ─── Item row ─────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: FaqItemData;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ItemRow({ item, isFirst, isLast, onMoveUp, onMoveDown, onEdit, onDelete }: ItemRowProps) {
  const preview = draftToPlainText(item.content);

  return (
    <div className="flex items-start gap-2 px-4 sm:px-5 py-3 group">
      <GripVertical className="w-4 h-4 text-[var(--kpi-gray-light)] shrink-0 mt-0.5" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-body font-medium text-[var(--foreground)] leading-snug break-words">
          {item.title}
        </p>
        {preview && (
          <p className="text-xs text-[var(--muted-foreground)] font-body mt-0.5 line-clamp-1 break-words">
            {preview}
          </p>
        )}
      </div>

      <div className="flex items-center gap-0.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          title="Вгору"
          className="w-6 h-6 flex items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30 transition-colors"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          title="Вниз"
          className="w-6 h-6 flex items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30 transition-colors"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onEdit}
          title="Редагувати"
          className="w-6 h-6 flex items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <Edit2 className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Видалити"
          className="w-6 h-6 flex items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--error)] transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Category card ────────────────────────────────────────────────────────────

export interface CategoryCardProps {
  category: FaqCategoryData;
  isFirst: boolean;
  isLast: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRename: () => void;
  onDelete: () => void;
  onAddItem: () => void;
  onEditItem: (item: FaqItemData) => void;
  onDeleteItem: (item: FaqItemData) => void;
  onMoveItemUp: (index: number) => void;
  onMoveItemDown: (index: number) => void;
}

export function CategoryCard({
  category,
  isFirst,
  isLast,
  isCollapsed,
  onToggleCollapse,
  onMoveUp,
  onMoveDown,
  onRename,
  onDelete,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onMoveItemUp,
  onMoveItemDown,
}: CategoryCardProps) {
  return (
    <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 sm:px-5 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--surface)]">
        <GripVertical className="w-4 h-4 text-[var(--kpi-gray-light)] shrink-0" />

        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex-1 min-w-0 text-left font-display text-base font-semibold text-[var(--foreground)] hover:text-[var(--kpi-navy)] transition-colors"
        >
          <span className="break-words">{category.title}</span>
          <span className="ml-2 text-xs font-body font-normal text-[var(--muted-foreground)]">
            ({category.items.length})
          </span>
        </button>

        {/* Reorder */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            title="Вгору"
            className="w-7 h-7 flex items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30 transition-colors"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            title="Вниз"
            className="w-7 h-7 flex items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30 transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onRename}
          title="Перейменувати"
          className="w-7 h-7 flex items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Видалити"
          className="w-7 h-7 flex items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Items */}
      {!isCollapsed && (
        <div className="divide-y divide-[var(--border-subtle)]">
          {category.items.map((item, idx) => (
            <ItemRow
              key={item.id}
              item={item}
              isFirst={idx === 0}
              isLast={idx === category.items.length - 1}
              onMoveUp={() => onMoveItemUp(idx)}
              onMoveDown={() => onMoveItemDown(idx)}
              onEdit={() => onEditItem(item)}
              onDelete={() => onDeleteItem(item)}
            />
          ))}

          <div className="px-4 sm:px-5 py-2.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddItem}
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
}
