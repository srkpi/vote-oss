import { ChevronDown, ChevronUp, Edit2, GripVertical, Trash2 } from 'lucide-react';

import { deltaToPlainText } from '@/lib/utils';
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
        <div className="pointer-events-none absolute top-0 right-4 left-4 z-10 h-0.5 rounded-full bg-(--kpi-blue-light)" />
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
          isDragging ? 'bg-(--surface) opacity-40' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-(--kpi-gray-light) transition-colors hover:text-(--muted-foreground) active:cursor-grabbing" />

        <div className="min-w-0 flex-1">
          <p className="font-body text-sm leading-snug font-medium wrap-break-word text-(--foreground)">
            {item.title}
          </p>
          {preview && (
            <p className="font-body mt-0.5 line-clamp-1 text-xs wrap-break-word text-(--muted-foreground)">
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
            className="flex h-6 w-6 items-center justify-center rounded text-(--muted-foreground) transition-colors hover:text-(--foreground) disabled:opacity-30"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            title="Вниз"
            className="flex h-6 w-6 items-center justify-center rounded text-(--muted-foreground) transition-colors hover:text-(--foreground) disabled:opacity-30"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            title="Редагувати"
            className="flex h-6 w-6 items-center justify-center rounded text-(--muted-foreground) transition-colors hover:text-(--foreground)"
          >
            <Edit2 className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Видалити"
            className="flex h-6 w-6 items-center justify-center rounded text-(--muted-foreground) transition-colors hover:text-(--error)"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Drop indicator – below */}
      {isDragOver && dragOverPosition === 'below' && (
        <div className="pointer-events-none absolute right-4 bottom-0 left-4 z-10 h-0.5 rounded-full bg-(--kpi-blue-light)" />
      )}
    </div>
  );
}
