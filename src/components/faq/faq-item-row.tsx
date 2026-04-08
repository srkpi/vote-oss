import { ChevronDown, ChevronUp, Edit2, GripVertical, Trash2 } from 'lucide-react';

import { deltaToPlainText } from '@/lib/utils/common';
import type { FaqItemData } from '@/types/faq';

interface FaqItemRowProps {
  item: FaqItemData;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  dragOverPosition: 'above' | 'below' | null;
  dragTypeKey: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: (index: number) => void;
  onDragEnter: (index: number, position: 'above' | 'below') => void;
  onDragEnd: () => void;
  onDrop: (index: number) => void;
}

export function FaqItemRow({
  item,
  index,
  isFirst,
  isLast,
  isDragging,
  isDragOver,
  dragOverPosition,
  dragTypeKey,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
}: FaqItemRowProps) {
  const preview = deltaToPlainText(item.content);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    // Only accept drags that originated from this exact category
    if (!e.dataTransfer.types.includes(dragTypeKey)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    onDragEnter(index, e.clientY < midY ? 'above' : 'below');
  };

  return (
    <div
      className="relative"
      onDragOver={handleDragOver}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes(dragTypeKey)) return;
        e.preventDefault();
        e.stopPropagation();
        onDrop(index);
      }}
    >
      {/* Drop indicator – above */}
      {isDragOver && dragOverPosition === 'above' && (
        <div className="bg-kpi-blue-light pointer-events-none absolute top-0 right-4 left-4 z-10 h-0.5 rounded-full" />
      )}

      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          // Scoped key: only rows inside this same category will accept this drag
          e.dataTransfer.setData(dragTypeKey, '');
          const ghost = document.createElement('div');
          ghost.style.position = 'fixed';
          ghost.style.top = '-9999px';
          document.body.appendChild(ghost);
          e.dataTransfer.setDragImage(ghost, 0, 0);
          setTimeout(() => document.body.removeChild(ghost), 0);
          onDragStart(index);
        }}
        onDragEnd={onDragEnd}
        className={[
          'group flex items-start gap-2 px-4 py-3 transition-all duration-150 sm:px-5',
          isDragging ? 'bg-surface opacity-40' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <GripVertical className="text-kpi-gray-light hover:text-muted-foreground mt-0.5 h-4 w-4 shrink-0 cursor-grab transition-colors active:cursor-grabbing" />

        <div className="min-w-0 flex-1">
          <p className="font-body text-foreground text-sm leading-snug font-medium wrap-break-word">
            {item.title}
          </p>
          {preview && (
            <p className="font-body text-muted-foreground mt-0.5 line-clamp-1 text-xs wrap-break-word">
              {preview}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            title="Вгору"
            className="text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center rounded transition-colors disabled:opacity-30"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            title="Вниз"
            className="text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center rounded transition-colors disabled:opacity-30"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            title="Редагувати"
            className="text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center rounded transition-colors"
          >
            <Edit2 className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Видалити"
            className="text-muted-foreground hover:text-error flex h-6 w-6 items-center justify-center rounded transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Drop indicator – below */}
      {isDragOver && dragOverPosition === 'below' && (
        <div className="bg-kpi-blue-light pointer-events-none absolute right-4 bottom-0 left-4 z-10 h-0.5 rounded-full" />
      )}
    </div>
  );
}
