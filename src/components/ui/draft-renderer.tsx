import React from 'react';

import { cn, parseDraftContent } from '@/lib/utils';
import type { RawDraftBlock, RawDraftContent, RawDraftEntity } from '@/types/faq';

// ─── Segment builder ─────────────────────────────────────────────────────────
// Splits a block's text into runs that share the same inline styles + entity.

interface Segment {
  text: string;
  styles: Set<string>;
  entityKey: number | undefined;
}

function buildSegments(block: RawDraftBlock): Segment[] {
  const { text, inlineStyleRanges, entityRanges } = block;
  const len = text.length;
  if (len === 0) return [];

  // Per-character metadata
  const styleAt: Set<string>[] = Array.from({ length: len }, () => new Set<string>());
  const entityAt: (number | undefined)[] = new Array(len).fill(undefined);

  for (const r of inlineStyleRanges) {
    for (let i = r.offset; i < r.offset + r.length && i < len; i++) {
      styleAt[i].add(r.style);
    }
  }
  for (const r of entityRanges) {
    for (let i = r.offset; i < r.offset + r.length && i < len; i++) {
      entityAt[i] = r.key;
    }
  }

  // Merge consecutive characters with identical metadata into segments
  const segments: Segment[] = [];
  let start = 0;

  for (let i = 1; i <= len; i++) {
    if (i === len) {
      segments.push({
        text: text.slice(start, i),
        styles: styleAt[start],
        entityKey: entityAt[start],
      });
      break;
    }

    const sameEntity = entityAt[i] === entityAt[start];
    const sameStyles =
      styleAt[i].size === styleAt[start].size &&
      [...styleAt[start]].every((s) => styleAt[i].has(s));

    if (!sameEntity || !sameStyles) {
      segments.push({
        text: text.slice(start, i),
        styles: styleAt[start],
        entityKey: entityAt[start],
      });
      start = i;
    }
  }

  return segments;
}

// ─── Segment renderer ────────────────────────────────────────────────────────

function renderSegment(
  seg: Segment,
  idx: number,
  entityMap: RawDraftContent['entityMap'],
): React.ReactNode {
  let node: React.ReactNode = seg.text;

  if (seg.styles.has('BOLD')) node = <strong>{node}</strong>;
  if (seg.styles.has('ITALIC')) node = <em>{node}</em>;
  if (seg.styles.has('UNDERLINE')) node = <u>{node}</u>;
  if (seg.styles.has('CODE'))
    node = (
      <code className="bg-[var(--surface)] border border-[var(--border-subtle)] px-1 py-0.5 rounded text-[0.8em] font-mono">
        {node}
      </code>
    );

  if (seg.entityKey !== undefined) {
    const entity: RawDraftEntity | undefined = entityMap[seg.entityKey];
    if (entity?.type === 'LINK') {
      const href = (entity.data.url ?? entity.data.href ?? '#') as string;
      node = (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--kpi-blue-light)] underline hover:text-[var(--kpi-blue-dark)] transition-colors"
        >
          {node}
        </a>
      );
    }
  }

  return <React.Fragment key={idx}>{node}</React.Fragment>;
}

function renderBlockContent(
  block: RawDraftBlock,
  entityMap: RawDraftContent['entityMap'],
): React.ReactNode {
  const segs = buildSegments(block);
  return segs.map((s, i) => renderSegment(s, i, entityMap));
}

// ─── Block grouper ───────────────────────────────────────────────────────────
// Consecutive list items of the same type must be wrapped in a single <ul>/<ol>.

type BlockGroup =
  | { kind: 'ul'; blocks: RawDraftBlock[] }
  | { kind: 'ol'; blocks: RawDraftBlock[] }
  | { kind: 'single'; block: RawDraftBlock };

function groupBlocks(blocks: RawDraftBlock[]): BlockGroup[] {
  const groups: BlockGroup[] = [];
  let i = 0;

  while (i < blocks.length) {
    const b = blocks[i];

    if (b.type === 'unordered-list-item') {
      const items: RawDraftBlock[] = [];
      while (i < blocks.length && blocks[i].type === 'unordered-list-item') items.push(blocks[i++]);
      groups.push({ kind: 'ul', blocks: items });
    } else if (b.type === 'ordered-list-item') {
      const items: RawDraftBlock[] = [];
      while (i < blocks.length && blocks[i].type === 'ordered-list-item') items.push(blocks[i++]);
      groups.push({ kind: 'ol', blocks: items });
    } else {
      groups.push({ kind: 'single', block: b });
      i++;
    }
  }

  return groups;
}

// ─── Group renderer ──────────────────────────────────────────────────────────

function renderGroup(
  group: BlockGroup,
  groupIdx: number,
  entityMap: RawDraftContent['entityMap'],
): React.ReactNode {
  if (group.kind === 'ul') {
    return (
      <ul key={`ul-${groupIdx}`} className="list-disc pl-5 my-1.5 space-y-0.5">
        {group.blocks.map((b) => (
          <li key={b.key}>{renderBlockContent(b, entityMap)}</li>
        ))}
      </ul>
    );
  }

  if (group.kind === 'ol') {
    return (
      <ol key={`ol-${groupIdx}`} className="list-decimal pl-5 my-1.5 space-y-0.5">
        {group.blocks.map((b) => (
          <li key={b.key}>{renderBlockContent(b, entityMap)}</li>
        ))}
      </ol>
    );
  }

  const { block } = group;
  const content = renderBlockContent(block, entityMap);

  switch (block.type) {
    case 'unstyled':
      return block.text === '' ? (
        <br key={block.key} />
      ) : (
        <p key={block.key} className="mb-1.5 last:mb-0">
          {content}
        </p>
      );

    case 'header-one':
      return (
        <p key={block.key} className="text-base font-semibold mb-1 mt-2 first:mt-0">
          {content}
        </p>
      );

    case 'header-two':
      return (
        <p key={block.key} className="text-sm font-semibold mb-1 mt-1.5 first:mt-0">
          {content}
        </p>
      );

    case 'blockquote':
      return (
        <blockquote
          key={block.key}
          className="border-l-2 border-[var(--border-color)] pl-3 italic text-[var(--muted-foreground)] my-1.5"
        >
          {content}
        </blockquote>
      );

    default:
      return null;
  }
}

export interface DraftRendererProps {
  content: string;
  className?: string;
}

export function DraftRenderer({ content, className }: DraftRendererProps) {
  const raw = parseDraftContent(content);
  if (!raw) return null;

  const groups = groupBlocks(raw.blocks);

  return (
    <div
      className={cn(
        'text-sm font-body text-[var(--foreground)]/80 leading-relaxed break-words',
        className,
      )}
    >
      {groups.map((group, i) => renderGroup(group, i, raw.entityMap))}
    </div>
  );
}
