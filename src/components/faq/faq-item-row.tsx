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
        <div className="absolute top-0 left-4 right-4 h-0.5 bg-[var(--kpi-blue-light)] rounded-full z-10 pointer-events-none" />
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
          'flex items-start gap-2 px-4 sm:px-5 py-3 group transition-all duration-150',
          isDragging ? 'opacity-40 bg-[var(--surface)]' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <GripVertical className="w-4 h-4 text-[var(--kpi-gray-light)] hover:text-[var(--muted-foreground)] shrink-0 mt-0.5 cursor-grab active:cursor-grabbing transition-colors" />

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

      {/* Drop indicator – below */}
      {isDragOver && dragOverPosition === 'below' && (
        <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-[var(--kpi-blue-light)] rounded-full z-10 pointer-events-none" />
      )}
    </div>
  );
}
