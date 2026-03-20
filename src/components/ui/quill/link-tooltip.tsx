'use client';

import { Check, ExternalLink, Pencil, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';

interface LinkTooltipProps {
  anchorRect: DOMRect;
  /** Current href — empty string means create mode */
  href: string;
  onSave: (url: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

const TOOLTIP_OFFSET = 8;

function IconButton({
  onClick,
  title,
  accent,
  danger,
  disabled,
  children,
}: {
  onClick: () => void;
  title: string;
  accent?: boolean;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-sm',
        'transition-colors focus:outline-none',
        disabled
          ? 'text-subtle cursor-not-allowed'
          : cn(
              'cursor-pointer',
              accent
                ? 'text-kpi-blue-light,#3b82f6 hover:bg-surface-hover'
                : danger
                  ? 'text-error,#ef4444 hover:bg-surface-hover'
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
            ),
      )}
    >
      {children}
    </button>
  );
}

export function LinkTooltip({ anchorRect, href, onSave, onRemove, onClose }: LinkTooltipProps) {
  const [input, setInput] = useState(href);
  const [isEditing, setIsEditing] = useState(href === '');
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing) setTimeout(() => inputRef.current?.focus(), 0);
  }, [isEditing]);

  // Dismiss on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const top = anchorRect.bottom + window.scrollY + TOOLTIP_OFFSET;
  const left = anchorRect.left + window.scrollX;

  const handleSave = () => {
    const url = input.trim();
    if (!url) return;
    onSave(url.startsWith('http') ? url : `https://${url}`);
    setIsEditing(false);
  };

  return createPortal(
    <div
      ref={panelRef}
      style={{ position: 'absolute', top, left, zIndex: 99999 }}
      className="border-border-color bg-surface text-foreground flex items-center gap-2 rounded-(--radius) border px-3 py-2 text-sm whitespace-nowrap shadow-lg"
      onMouseDown={(e) => {
        // Prevent the editor from losing its selection when the user clicks
        // anywhere on the tooltip — EXCEPT on the input itself, which needs
        // normal browser focus behaviour to remain focusable.
        if (!(e.target instanceof HTMLInputElement)) {
          e.preventDefault();
        }
      }}
    >
      {isEditing ? (
        <>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleSave();
              }
            }}
            placeholder="https://example.com"
            className="border-border-subtle bg-surface text-foreground placeholder:text-subtle focus:border-border-color w-56 rounded-sm border px-2 py-0.5 text-sm outline-none"
          />
          <IconButton onClick={handleSave} title="Save" accent disabled={!input.trim()}>
            <Check size={14} />
          </IconButton>
          <IconButton onClick={onClose} title="Cancel">
            <X size={14} />
          </IconButton>
        </>
      ) : (
        <>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            title={href}
            className="text-kpi-blue-light,#3b82f6 max-w-60 truncate hover:underline"
          >
            <ExternalLink size={13} className="-mt-0.5 mr-1 inline" />
            {href}
          </a>
          <span className="text-border-subtle mx-0.5 select-none">|</span>
          <IconButton
            onClick={() => {
              setInput(href);
              setIsEditing(true);
            }}
            title="Edit link"
          >
            <Pencil size={13} />
          </IconButton>
          <IconButton onClick={onRemove} title="Remove link" danger>
            <Trash2 size={13} />
          </IconButton>
        </>
      )}
    </div>,
    document.body,
  );
}
