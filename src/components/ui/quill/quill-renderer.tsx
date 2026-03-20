import React from 'react';

import { cn, parseQuillDelta } from '@/lib/utils';
import type { QuillDeltaOp } from '@/types/quill';

// ---------------------------------------------------------------------------
// Line model
// ---------------------------------------------------------------------------

interface InlineSegment {
  text: string;
  attrs: Record<string, unknown>;
}

type BlockType =
  | 'paragraph'
  | 'list-bullet'
  | 'list-ordered'
  | 'header-1'
  | 'header-2'
  | 'header-3'
  | 'header-4'
  | 'blockquote'
  | 'code-block';

interface Line {
  segments: InlineSegment[];
  blockType: BlockType;
}

// ---------------------------------------------------------------------------
// Delta → Lines
// ---------------------------------------------------------------------------

/**
 * Convert a flat array of Delta ops into an array of logical lines.
 *
 * In Quill's Delta format:
 * - Block-level formatting (list type, header level …) is carried by the `\n`
 *   that ends each line.
 * - Inline formatting (bold, italic …) is carried by text insert ops.
 */
function parseLines(ops: QuillDeltaOp[]): Line[] {
  const lines: Line[] = [];
  let currentSegments: InlineSegment[] = [];

  const pushLine = (blockAttrs: Record<string, unknown> = {}) => {
    let blockType: BlockType = 'paragraph';

    if (blockAttrs.list === 'bullet') blockType = 'list-bullet';
    else if (blockAttrs.list === 'ordered') blockType = 'list-ordered';
    else if (blockAttrs.header === 1) blockType = 'header-1';
    else if (blockAttrs.header === 2) blockType = 'header-2';
    else if (blockAttrs.header === 3) blockType = 'header-3';
    else if (blockAttrs.header === 4) blockType = 'header-4';
    else if (blockAttrs.blockquote) blockType = 'blockquote';
    else if (blockAttrs['code-block']) blockType = 'code-block';

    lines.push({ segments: currentSegments, blockType });
    currentSegments = [];
  };

  for (const op of ops) {
    if (typeof op.insert !== 'string') continue;

    const text = op.insert;
    const attrs = op.attributes ?? {};
    const parts = text.split('\n');

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.length > 0) currentSegments.push({ text: part, attrs });
      if (i < parts.length - 1) pushLine(i === parts.length - 2 ? attrs : {});
    }
  }

  // Trailing content without a terminal \n (shouldn't happen in valid Quill
  // docs, but handle gracefully)
  if (currentSegments.length > 0) {
    lines.push({ segments: currentSegments, blockType: 'paragraph' });
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Inline segment renderer
// ---------------------------------------------------------------------------

function renderSegment(seg: InlineSegment, idx: number): React.ReactNode {
  let node: React.ReactNode = seg.text;
  const a = seg.attrs;

  if (a.link) {
    node = (
      <a
        href={a.link as string}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--kpi-blue-light)] underline hover:text-[var(--kpi-blue-dark)] transition-colors"
      >
        {node}
      </a>
    );
  }
  if (a.code) {
    node = (
      <code className="bg-[var(--surface)] border border-[var(--border-subtle)] px-1 py-0.5 rounded text-[0.8em] font-mono">
        {node}
      </code>
    );
  }
  if (a.bold) node = <strong className="font-semibold">{node}</strong>;
  if (a.italic) node = <em>{node}</em>;
  if (a.underline) node = <u>{node}</u>;
  if (a.strike) node = <s className="text-[var(--muted-foreground)]">{node}</s>;

  return <React.Fragment key={idx}>{node}</React.Fragment>;
}

function renderLineContent(segments: InlineSegment[]): React.ReactNode {
  return segments.map((s, i) => renderSegment(s, i));
}

// ---------------------------------------------------------------------------
// Block group renderer
// ---------------------------------------------------------------------------

type Group =
  | { kind: 'ul'; lines: Line[] }
  | { kind: 'ol'; lines: Line[] }
  | { kind: 'code'; lines: Line[] } // ← consecutive code-block lines → one <pre>
  | { kind: 'single'; line: Line };

function groupLines(lines: Line[]): Group[] {
  const groups: Group[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.blockType === 'list-bullet') {
      const items: Line[] = [];
      while (i < lines.length && lines[i].blockType === 'list-bullet') items.push(lines[i++]);
      groups.push({ kind: 'ul', lines: items });
    } else if (line.blockType === 'list-ordered') {
      const items: Line[] = [];
      while (i < lines.length && lines[i].blockType === 'list-ordered') items.push(lines[i++]);
      groups.push({ kind: 'ol', lines: items });
    } else if (line.blockType === 'code-block') {
      // Merge consecutive code-block lines into one <pre> block
      const items: Line[] = [];
      while (i < lines.length && lines[i].blockType === 'code-block') items.push(lines[i++]);
      groups.push({ kind: 'code', lines: items });
    } else {
      groups.push({ kind: 'single', line });
      i++;
    }
  }

  return groups;
}

function renderGroup(group: Group, idx: number): React.ReactNode {
  if (group.kind === 'ul') {
    return (
      <ul
        key={`ul-${idx}`}
        className="list-disc pl-5 my-1.5 space-y-0.5 text-[var(--foreground)]/80"
      >
        {group.lines.map((l, li) => (
          <li key={li}>{renderLineContent(l.segments)}</li>
        ))}
      </ul>
    );
  }

  if (group.kind === 'ol') {
    return (
      <ol
        key={`ol-${idx}`}
        className="list-decimal pl-5 my-1.5 space-y-0.5 text-[var(--foreground)]/80"
      >
        {group.lines.map((l, li) => (
          <li key={li}>{renderLineContent(l.segments)}</li>
        ))}
      </ol>
    );
  }

  if (group.kind === 'code') {
    // Each line's segments are plain text inside a code block — render them
    // as raw strings joined by newlines so whitespace is preserved correctly.
    const raw = group.lines.map((l) => l.segments.map((s) => s.text).join('')).join('\n');
    return (
      <pre
        key={`code-${idx}`}
        className={cn(
          'my-2 rounded-[var(--radius-sm)]',
          'bg-[var(--surface)] border border-[var(--border-subtle)]',
          'px-3.5 py-2.5',
          'text-[0.8125rem] font-mono leading-relaxed',
          'overflow-x-auto whitespace-pre',
          'text-[var(--foreground)]',
        )}
      >
        {raw}
      </pre>
    );
  }

  // Single-line blocks
  const { line } = group;
  const content = renderLineContent(line.segments);
  const isEmpty = line.segments.length === 0;

  switch (line.blockType) {
    case 'header-1':
      return (
        <h1
          key={idx}
          className="text-2xl font-bold leading-tight mt-3 mb-1.5 first:mt-0 text-[var(--foreground)]"
        >
          {content}
        </h1>
      );
    case 'header-2':
      return (
        <h2
          key={idx}
          className="text-xl font-semibold leading-snug mt-2.5 mb-1 first:mt-0 text-[var(--foreground)]"
        >
          {content}
        </h2>
      );
    case 'header-3':
      return (
        <h3
          key={idx}
          className="text-base font-semibold leading-snug mt-2 mb-1 first:mt-0 text-[var(--foreground)]"
        >
          {content}
        </h3>
      );
    case 'header-4':
      return (
        <h4
          key={idx}
          className="text-sm font-semibold leading-snug mt-1.5 mb-0.5 first:mt-0 text-[var(--muted-foreground)]"
        >
          {content}
        </h4>
      );
    case 'blockquote':
      return (
        <blockquote
          key={idx}
          className="border-l-[3px] border-[var(--border-color)] pl-3 italic text-[var(--muted-foreground)] my-1.5"
        >
          {content}
        </blockquote>
      );
    default:
      return isEmpty ? (
        <br key={idx} />
      ) : (
        <p key={idx} className="mb-1.5 last:mb-0">
          {content}
        </p>
      );
  }
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface QuillRendererProps {
  content: string;
  className?: string;
}

export function QuillRenderer({ content, className }: QuillRendererProps) {
  const delta = parseQuillDelta(content);
  if (!delta) return null;

  const lines = parseLines(delta.ops);
  const groups = groupLines(lines);

  return (
    <div
      className={cn(
        'text-sm font-body text-[var(--foreground)]/80 leading-relaxed break-words',
        className,
      )}
    >
      {groups.map((g, i) => renderGroup(g, i))}
    </div>
  );
}
