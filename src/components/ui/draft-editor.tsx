'use client';

// NOTE: This file must NOT be imported with SSR.
// Consumers should use:
//   const DraftEditor = dynamic(() => import('@/components/ui/draft-editor'), { ssr: false });

import 'draft-js/dist/Draft.css';

import {
  type ContentBlock,
  convertFromRaw,
  convertToRaw,
  type DraftEditorCommand,
  type DraftHandleValue,
  Editor,
  EditorState,
  getDefaultKeyBinding,
  type RawDraftContentState,
  RichUtils,
} from 'draft-js';
import { Bold, Italic, List, ListOrdered, Underline } from 'lucide-react';
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createEditorState(value: string): EditorState {
  if (!value) return EditorState.createEmpty();
  try {
    const raw = JSON.parse(value) as RawDraftContentState;
    return EditorState.createWithContent(convertFromRaw(raw));
  } catch {
    return EditorState.createEmpty();
  }
}

export function getPlainTextLength(value: string): number {
  if (!value) return 0;
  try {
    const raw = JSON.parse(value) as RawDraftContentState;
    const state = EditorState.createWithContent(convertFromRaw(raw));
    return state.getCurrentContent().getPlainText('\n').length;
  } catch {
    return 0;
  }
}

function toJsonString(state: EditorState): string {
  return JSON.stringify(convertToRaw(state.getCurrentContent()));
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

const BLOCK_STYLE_MAP: Record<string, string> = {
  'unordered-list-item': 'draft-unordered-list-item',
  'ordered-list-item': 'draft-ordered-list-item',
};

function blockStyleFn(block: ContentBlock): string {
  return BLOCK_STYLE_MAP[block.getType()] ?? '';
}

type ToolbarItem = {
  label: string;
  icon: React.ReactNode;
  style: string;
  kind: 'inline' | 'block';
};

const TOOLBAR: ToolbarItem[] = [
  { label: 'Bold', icon: <Bold className="w-3.5 h-3.5" />, style: 'BOLD', kind: 'inline' },
  { label: 'Italic', icon: <Italic className="w-3.5 h-3.5" />, style: 'ITALIC', kind: 'inline' },
  {
    label: 'Underline',
    icon: <Underline className="w-3.5 h-3.5" />,
    style: 'UNDERLINE',
    kind: 'inline',
  },
  {
    label: 'Bullet list',
    icon: <List className="w-3.5 h-3.5" />,
    style: 'unordered-list-item',
    kind: 'block',
  },
  {
    label: 'Numbered list',
    icon: <ListOrdered className="w-3.5 h-3.5" />,
    style: 'ordered-list-item',
    kind: 'block',
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export interface DraftEditorProps {
  /** JSON string of RawDraftContentState, or empty string for a new document */
  value: string;
  /** Called with the updated JSON string on every change */
  onChange: (value: string) => void;
  placeholder?: string;
  /** Maximum plain-text character count */
  maxLength?: number;
  error?: boolean;
  className?: string;
  minHeight?: string;
}

export default function DraftEditor({
  value,
  onChange,
  placeholder = 'Enter content…',
  maxLength,
  error = false,
  className,
  minHeight = '160px',
}: DraftEditorProps) {
  const [editorState, setEditorState] = useState<EditorState>(() => createEditorState(value));
  const editorRef = useRef<Editor>(null);
  // Track the last value we emitted so external resets can be detected
  const lastEmitted = useRef(value);

  // Sync when the parent resets the value (e.g. dialog re-open)
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditorState(createEditorState(value));
    }
  }, [value]);

  const handleChange = useCallback(
    (state: EditorState) => {
      setEditorState(state);
      const json = toJsonString(state);
      lastEmitted.current = json;
      onChange(json);
    },
    [onChange],
  );

  const handleKeyCommand = useCallback(
    (command: DraftEditorCommand, state: EditorState): DraftHandleValue => {
      const next = RichUtils.handleKeyCommand(state, command);
      if (next) {
        handleChange(next);
        return 'handled';
      }
      return 'not-handled';
    },
    [handleChange],
  );

  const keyBindingFn = useCallback(
    (e: KeyboardEvent): DraftEditorCommand | null => getDefaultKeyBinding(e),
    [],
  );

  const toggleInline = (style: string) =>
    handleChange(RichUtils.toggleInlineStyle(editorState, style));

  const toggleBlock = (type: string) => handleChange(RichUtils.toggleBlockType(editorState, type));

  const currentInline = editorState.getCurrentInlineStyle();
  const currentBlock = editorState
    .getCurrentContent()
    .getBlockForKey(editorState.getSelection().getStartKey())
    .getType();

  const plainLength = editorState.getCurrentContent().getPlainText('\n').length;
  const isOverLimit = maxLength !== undefined && plainLength > maxLength;
  const isEmpty = !editorState.getCurrentContent().hasText();

  return (
    <div
      className={cn(
        'flex flex-col rounded-[var(--radius)] border overflow-hidden',
        error || isOverLimit ? 'border-[var(--error)]' : 'border-[var(--border-color)]',
        className,
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-[var(--surface)] border-b border-[var(--border-subtle)]">
        {TOOLBAR.map((ctrl) => {
          const active =
            ctrl.kind === 'inline' ? currentInline.has(ctrl.style) : currentBlock === ctrl.style;
          return (
            <button
              key={ctrl.style}
              type="button"
              title={ctrl.label}
              aria-label={ctrl.label}
              onMouseDown={(e) => {
                e.preventDefault();
                if (ctrl.kind === 'inline') {
                  toggleInline(ctrl.style);
                } else {
                  toggleBlock(ctrl.style);
                }
              }}
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)]',
                'transition-colors duration-150',
                active
                  ? 'bg-[var(--kpi-navy)] text-white'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]',
              )}
            >
              {ctrl.icon}
            </button>
          );
        })}

        {maxLength !== undefined && (
          <span
            className={cn(
              'ml-auto text-xs font-body tabular-nums',
              isOverLimit ? 'text-[var(--error)] font-semibold' : 'text-[var(--muted-foreground)]',
            )}
            aria-live="polite"
          >
            {isOverLimit ? `-${plainLength - maxLength}` : maxLength - plainLength}
          </span>
        )}
      </div>

      {/* Editable area */}
      <div
        style={{ minHeight }}
        className={cn(
          'relative px-3 py-2.5 bg-white cursor-text',
          'text-sm font-body text-[var(--foreground)]',
          '[&_.DraftEditor-root]:outline-none',
          '[&_.public-DraftStyleDefault-ul]:list-disc [&_.public-DraftStyleDefault-ul]:pl-5 [&_.public-DraftStyleDefault-ul]:my-1',
          '[&_.public-DraftStyleDefault-ol]:list-decimal [&_.public-DraftStyleDefault-ol]:pl-5 [&_.public-DraftStyleDefault-ol]:my-1',
        )}
        onClick={() => editorRef.current?.focus()}
      >
        {isEmpty && (
          <div
            className="absolute top-2.5 left-3 text-[var(--subtle)] text-sm font-body pointer-events-none select-none"
            aria-hidden="true"
          >
            {placeholder}
          </div>
        )}
        <Editor
          ref={editorRef}
          editorState={editorState}
          onChange={handleChange}
          handleKeyCommand={handleKeyCommand}
          keyBindingFn={keyBindingFn}
          blockStyleFn={blockStyleFn}
          placeholder=""
          spellCheck
        />
      </div>
    </div>
  );
}
