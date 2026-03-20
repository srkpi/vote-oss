'use client';

// NOTE: This file must NOT be imported with SSR.
// Consumers should use:
//   const QuillEditor = dynamic(() => import('@/components/ui/quill-editor'), { ssr: false });

import 'quill/dist/quill.snow.css';
import './quill-editor.css';

import type { EmitterSource, Range as QuillRange } from 'quill';
import Quill from 'quill';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { CharCounter } from '@/components/ui/char-counter';
import { LinkTooltip } from '@/components/ui/quill/link-tooltip';
import { cn } from '@/lib/utils';

const TOOLBAR_CONFIG = [
  [{ header: [1, 2, 3, 4, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  ['link', 'blockquote', 'code-block'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['clean'],
];

/**
 * Given a cursor position inside a link, scan outward to find the full
 * extent of that link so edit/remove can operate on the whole linked text
 * even when no text is explicitly selected.
 */
function getLinkRange(quill: Quill, cursorIndex: number): QuillRange {
  let start = cursorIndex;
  let end = cursorIndex;

  // Scan backwards while link format is present at each position
  while (start > 0 && quill.getFormat(start - 1, 1).link) {
    start--;
  }
  // Scan forwards while link format is present
  const textLength = quill.getText().length;
  while (end < textLength && quill.getFormat(end, 1).link) {
    end++;
  }

  return { index: start, length: end - start };
}

export interface QuillEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  error?: boolean;
  className?: string;
  minHeight?: string;
  /** Cap editor area height — long content scrolls inside rather than growing the modal. */
  maxHeight?: string;
}

interface TooltipState {
  anchorRect: DOMRect;
  href: string;
  /** The cursor/selection range that triggered the tooltip. */
  range: QuillRange;
}

export default function QuillEditor({
  value,
  onChange,
  placeholder = 'Enter content…',
  maxLength,
  error = false,
  className,
  minHeight = '160px',
  maxHeight,
}: QuillEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const onChangeRef = useRef(onChange);
  const lastEmitted = useRef(value);
  const [charCount, setCharCount] = useState(0);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  });

  const getSelectionRect = (quill: Quill): DOMRect | null => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) return rect;
    }
    return quill.root.getBoundingClientRect();
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const editorDiv = container.ownerDocument.createElement('div');
    container.appendChild(editorDiv);

    const quill = new Quill(editorDiv, {
      theme: 'snow',
      modules: {
        toolbar: {
          container: TOOLBAR_CONFIG,
          handlers: {
            link() {
              const range = quill.getSelection();
              if (!range) return;
              const existingHref = (quill.getFormat(range).link as string | undefined) ?? '';
              const rect = getSelectionRect(quill);
              if (!rect) return;
              setTooltip({ anchorRect: rect, href: existingHref, range });
            },
          },
        },
        keyboard: { bindings: { tab: false } },
      },
      placeholder,
    });

    quillRef.current = quill;

    // Suppress the native Snow tooltip — we render our own portal instead
    const nativeTooltip = container.querySelector('.ql-tooltip') as HTMLElement | null;
    if (nativeTooltip) nativeTooltip.style.display = 'none';

    // Open tooltip when cursor lands on an existing link
    quill.on('selection-change' as Parameters<typeof quill.on>[0], (range: QuillRange | null) => {
      if (!range) return; // editor lost focus — keep tooltip open for interaction

      const format = quill.getFormat(range);
      if (format.link) {
        const rect = getSelectionRect(quill);
        if (rect) setTooltip({ anchorRect: rect, href: format.link as string, range });
      } else {
        setTooltip(null);
      }
    });

    if (value) {
      try {
        quill.setContents(JSON.parse(value), 'silent' as EmitterSource);
      } catch {
        /* ignore */
      }
    }

    setCharCount(Math.max(0, quill.getText().length - 1));

    quill.on('text-change' as Parameters<typeof quill.on>[0], () => {
      const json = JSON.stringify(quill.getContents());
      lastEmitted.current = json;
      onChangeRef.current(json);
      setCharCount(Math.max(0, quill.getText().length - 1));
    });

    return () => {
      quillRef.current = null;
      container.innerHTML = '';
      setTooltip(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync when parent resets the value (e.g. dialog re-open)
  useEffect(() => {
    const quill = quillRef.current;
    if (!quill || value === lastEmitted.current) return;
    try {
      quill.setContents(JSON.parse(value), 'silent' as EmitterSource);
      lastEmitted.current = value;
      setCharCount(Math.max(0, quill.getText().length - 1));
    } catch {
      /* ignore */
    }
  }, [value]);

  // ── Tooltip handlers ────────────────────────────────────────────────────

  const handleLinkSave = (url: string) => {
    const quill = quillRef.current;
    if (!quill || !tooltip) return;

    // If the user only placed a cursor (no selection), expand to the full
    // link blot so the edit applies to the entire linked text.
    const range =
      tooltip.range.length > 0 ? tooltip.range : getLinkRange(quill, tooltip.range.index);

    quill.formatText(range.index, range.length, 'link', url);
    setTooltip(null);
    quill.focus();
  };

  const handleLinkRemove = () => {
    const quill = quillRef.current;
    if (!quill || !tooltip) return;

    const range =
      tooltip.range.length > 0 ? tooltip.range : getLinkRange(quill, tooltip.range.index);

    quill.formatText(range.index, range.length, 'link', false);
    setTooltip(null);
    quill.focus();
  };

  const isOverLimit = maxLength !== undefined && charCount > maxLength;

  return (
    <>
      <div
        className={cn(
          'flex flex-col rounded-[var(--radius)] border',
          error || isOverLimit ? 'border-[var(--error)]' : 'border-[var(--border-color)]',
          className,
        )}
        onClick={() => quillRef.current?.focus()}
      >
        <div
          ref={containerRef}
          style={
            {
              '--editor-min-height': minHeight,
              '--editor-max-height': maxHeight,
            } as React.CSSProperties
          }
          className={cn(
            '[&_.ql-editor]:min-h-[var(--editor-min-height)] [&_.ql-editor]:px-3 [&_.ql-editor]:py-2.5',
            maxHeight &&
              '[&_.ql-editor]:max-h-[var(--editor-max-height)] [&_.ql-editor]:overflow-y-auto',
          )}
        />

        {maxLength !== undefined && (
          <CharCounter
            value={charCount}
            max={maxLength}
            threshold={0}
            className="px-3 py-1.5 border-t border-[var(--border-subtle)] bg-[var(--surface)] flex justify-end rounded-b-[var(--radius)]"
          />
        )}
      </div>

      {tooltip && (
        <LinkTooltip
          anchorRect={tooltip.anchorRect}
          href={tooltip.href}
          onSave={handleLinkSave}
          onRemove={handleLinkRemove}
          onClose={() => setTooltip(null)}
        />
      )}
    </>
  );
}
