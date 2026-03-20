'use client';

import { Bold, Italic, Link, List, ListOrdered, Minus, Underline } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  maxLength?: number;
  error?: boolean;
  className?: string;
  minHeight?: string;
}

type ToolbarButton = {
  icon: React.ReactNode;
  label: string;
  command: string;
  value?: string;
};

const TOOLBAR: ToolbarButton[] = [
  { icon: <Bold className="w-3.5 h-3.5" />, label: 'Bold', command: 'bold' },
  { icon: <Italic className="w-3.5 h-3.5" />, label: 'Italic', command: 'italic' },
  { icon: <Underline className="w-3.5 h-3.5" />, label: 'Underline', command: 'underline' },
  { icon: <List className="w-3.5 h-3.5" />, label: 'Bullet list', command: 'insertUnorderedList' },
  {
    icon: <ListOrdered className="w-3.5 h-3.5" />,
    label: 'Numbered list',
    command: 'insertOrderedList',
  },
  {
    icon: <Minus className="w-3.5 h-3.5" />,
    label: 'Horizontal rule',
    command: 'insertHorizontalRule',
  },
];

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Enter content…',
  maxLength,
  error = false,
  className,
  minHeight = '160px',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const internalUpdate = useRef(false);
  const [textLength, setTextLength] = useState(0);

  // Sync external value → DOM (only when it differs, to avoid caret reset)
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (internalUpdate.current) {
      internalUpdate.current = false;
      return;
    }
    if (el.innerHTML !== value) {
      el.innerHTML = value;
      setTextLength(el.innerText.length);
    }
  }, [value]);

  const handleInput = () => {
    const el = editorRef.current;
    if (!el) return;
    internalUpdate.current = true;
    const text = el.innerText;

    setTextLength(text.length);
    onChange(el.innerHTML);
  };

  const execCommand = (command: string, val?: string) => {
    document.execCommand(command, false, val ?? undefined);
    editorRef.current?.focus();
    // Trigger change after execCommand
    handleInput();
  };

  const handleLink = () => {
    const url = window.prompt('Enter URL:', 'https://');
    if (url) execCommand('createLink', url);
  };

  const isOverLimit = maxLength !== undefined && textLength > maxLength;

  return (
    <div
      className={cn(
        'flex flex-col gap-0 rounded-[var(--radius)] border overflow-hidden',
        error || isOverLimit ? 'border-[var(--error)]' : 'border-[var(--border-color)]',
        className,
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-[var(--surface)] border-b border-[var(--border-subtle)]">
        {TOOLBAR.map((btn) => (
          <button
            key={btn.command}
            type="button"
            title={btn.label}
            aria-label={btn.label}
            onMouseDown={(e) => {
              e.preventDefault(); // prevent blur
              execCommand(btn.command);
            }}
            className={cn(
              'w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)]',
              'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
              'hover:bg-[var(--surface-hover)] transition-colors duration-150',
            )}
          >
            {btn.icon}
          </button>
        ))}

        {/* Link button handled separately */}
        <button
          type="button"
          title="Insert link"
          aria-label="Insert link"
          onMouseDown={(e) => {
            e.preventDefault();
            handleLink();
          }}
          className={cn(
            'w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)]',
            'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
            'hover:bg-[var(--surface-hover)] transition-colors duration-150',
          )}
        >
          <Link className="w-3.5 h-3.5" />
        </button>

        {maxLength !== undefined && (
          <span
            className={cn(
              'ml-auto text-xs font-body tabular-nums',
              isOverLimit ? 'text-[var(--error)] font-semibold' : 'text-[var(--muted-foreground)]',
            )}
          >
            {isOverLimit ? `-${textLength - maxLength}` : `${maxLength - textLength}`}
          </span>
        )}
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder={placeholder}
        style={{ minHeight }}
        className={cn(
          'px-3 py-2.5 text-sm font-body text-[var(--foreground)] outline-none',
          'focus:ring-2 focus:ring-inset focus:ring-[var(--kpi-blue-light)]/20',
          'bg-white',
          // Placeholder via CSS
          '[&:empty]:before:content-[attr(data-placeholder)]',
          '[&:empty]:before:text-[var(--subtle)]',
          '[&:empty]:before:pointer-events-none',
          // Prose styles
          '[&_strong]:font-semibold',
          '[&_em]:italic',
          '[&_u]:underline',
          '[&_a]:text-[var(--kpi-blue-light)] [&_a]:underline',
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1',
          '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1',
          '[&_li]:my-0.5',
          '[&_hr]:border-[var(--border-color)] [&_hr]:my-2',
        )}
      />
    </div>
  );
}
