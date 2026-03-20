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
        <div className="absolute -top-px left-0 right-0 h-0.5 bg-[var(--kpi-blue-light)] rounded-full z-20 pointer-events-none" />
      )}

      <div
        className={[
          'bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden transition-all duration-150',
          isDragging ? 'opacity-40 scale-[0.995]' : '',
          isDragOver ? 'ring-1 ring-[var(--kpi-blue-light)]' : '',
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
        <div className="flex items-center gap-2 px-4 sm:px-5 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--surface)]">
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
            <GripVertical className="w-4 h-4 text-[var(--kpi-gray-light)] hover:text-[var(--muted-foreground)] transition-colors pointer-events-none" />
          </div>

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

        {!isCollapsed && (
          <div className="divide-y divide-[var(--border-subtle)]">
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
    </div>
  );
}
