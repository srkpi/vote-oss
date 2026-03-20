'use client';

import { ChevronDown, ChevronUp, Edit2, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { FaqItemRow } from '@/components/faq/faq-item-row';
import { Button } from '@/components/ui/button';
import type { FaqCategoryData, FaqItemData } from '@/types/faq';

export interface CategoryCardProps {
  category: FaqCategoryData;
  isFirst: boolean;
  isLast: boolean;
  isCollapsed: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
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
  onMoveItemTo: (fromIndex: number, toIndex: number) => void;
  onCategoryDragStart?: () => void;
  onCategoryDragEnter?: () => void;
  onCategoryDragEnd?: () => void;
  onCategoryDrop?: () => void;
}

export function CategoryCard({
  category,
  isFirst,
  isLast,
  isCollapsed,
  isDragging = false,
  isDragOver = false,
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
  onMoveItemTo,
  onCategoryDragStart,
  onCategoryDragEnter,
  onCategoryDragEnd,
  onCategoryDrop,
}: CategoryCardProps) {
  const [itemDragIndex, setItemDragIndex] = useState<number | null>(null);
  const [itemDragOverIndex, setItemDragOverIndex] = useState<number | null>(null);
  const [itemDragOverPosition, setItemDragOverPosition] = useState<'above' | 'below' | null>(null);

  const itemDragTypeKey = `faq-item-${category.id}`;

  const handleItemDragStart = (index: number) => setItemDragIndex(index);
  const handleItemDragEnter = (index: number, position: 'above' | 'below') => {
    setItemDragOverIndex(index);
    setItemDragOverPosition(position);
  };
  const handleItemDragEnd = () => {
    setItemDragIndex(null);
    setItemDragOverIndex(null);
    setItemDragOverPosition(null);
  };

  const handleItemDrop = (toIndex: number) => {
    if (itemDragIndex === null || itemDragIndex === toIndex) {
      handleItemDragEnd();
      return;
    }
    let target = toIndex;
    if (itemDragOverPosition === 'below') target = toIndex + 1;
    if (itemDragIndex < target) target -= 1;
    if (target !== itemDragIndex) onMoveItemTo(itemDragIndex, target);
    handleItemDragEnd();
  };

  const handleCategoryDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes('faq-category')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // No position needed — we always show a single "insert before" line above
    onCategoryDragEnter?.();
  };

  return (
    <div className="relative">
      {isDragOver && (
        <div className="pointer-events-none absolute -top-px right-0 left-0 z-20 h-0.5 rounded-full bg-(--kpi-blue-light)" />
      )}

      <div
        className={[
          'overflow-hidden rounded-xl border border-(--border-color) bg-white shadow-(--shadow-card) transition-all duration-150',
          isDragging ? 'scale-[0.995] opacity-40' : '',
          isDragOver ? 'ring-1 ring-(--kpi-blue-light)' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onDragOver={handleCategoryDragOver}
        onDrop={(e) => {
          if (!e.dataTransfer.types.includes('faq-category')) return;
          e.preventDefault();
          onCategoryDrop?.();
        }}
      >
        <div className="flex items-center gap-2 border-b border-(--border-subtle) bg-(--surface) px-4 py-3.5 sm:px-5">
          <div
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('faq-category', '');
              const ghost = document.createElement('div');
              ghost.style.position = 'fixed';
              ghost.style.top = '-9999px';
              document.body.appendChild(ghost);
              e.dataTransfer.setDragImage(ghost, 0, 0);
              setTimeout(() => document.body.removeChild(ghost), 0);
              onCategoryDragStart?.();
            }}
            onDragEnd={(e) => {
              e.stopPropagation();
              onCategoryDragEnd?.();
            }}
            className="shrink-0 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="pointer-events-none h-4 w-4 text-(--kpi-gray-light) transition-colors hover:text-(--muted-foreground)" />
          </div>

          <button
            type="button"
            onClick={onToggleCollapse}
            className="font-display min-w-0 flex-1 text-left text-base font-semibold text-(--foreground) transition-colors hover:text-(--kpi-navy)"
          >
            <span className="wrap-break-word">{category.title}</span>
            <span className="font-body ml-2 text-xs font-normal text-(--muted-foreground)">
              ({category.items.length})
            </span>
          </button>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={isFirst}
              title="Вгору"
              className="flex h-7 w-7 items-center justify-center rounded text-(--muted-foreground) transition-colors hover:text-(--foreground) disabled:opacity-30"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={isLast}
              title="Вниз"
              className="flex h-7 w-7 items-center justify-center rounded text-(--muted-foreground) transition-colors hover:text-(--foreground) disabled:opacity-30"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onRename}
            title="Перейменувати"
            className="flex h-7 w-7 items-center justify-center rounded text-(--muted-foreground) transition-colors hover:bg-(--surface-hover) hover:text-(--foreground)"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Видалити"
            className="flex h-7 w-7 items-center justify-center rounded text-(--muted-foreground) transition-colors hover:bg-(--error-bg) hover:text-(--error)"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {!isCollapsed && (
          <div className="divide-y divide-(--border-subtle)">
            {category.items.map((item, idx) => (
              <FaqItemRow
                key={item.id}
                item={item}
                index={idx}
                isFirst={idx === 0}
                isLast={idx === category.items.length - 1}
                isDragging={itemDragIndex === idx}
                isDragOver={itemDragOverIndex === idx}
                dragOverPosition={itemDragOverIndex === idx ? itemDragOverPosition : null}
                dragTypeKey={itemDragTypeKey}
                onMoveUp={() => onMoveItemUp(idx)}
                onMoveDown={() => onMoveItemDown(idx)}
                onEdit={() => onEditItem(item)}
                onDelete={() => onDeleteItem(item)}
                onDragStart={handleItemDragStart}
                onDragEnter={handleItemDragEnter}
                onDragEnd={handleItemDragEnd}
                onDrop={handleItemDrop}
              />
            ))}

            <div className="px-4 py-2.5 sm:px-5">
              <Button
                variant="ghost"
                size="sm"
                onClick={onAddItem}
                icon={<Plus className="h-3.5 w-3.5" />}
                className="text-(--kpi-blue-light) hover:bg-(--info-bg)"
              >
                Додати пункт
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
