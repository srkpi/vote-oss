'use client';

import { ThumbsDown, ThumbsUp } from 'lucide-react';
import type { RefObject } from 'react';
import { useEffect, useState } from 'react';

import { Avatar } from '@/components/ui/avatar';
import { LocalDateTime } from '@/components/ui/local-time';
import { Popover } from '@/components/ui/popover';
import { api } from '@/lib/api/browser';
import type { CommentVoter } from '@/types/comment';

interface CommentVotersPopoverProps {
  electionId: string;
  commentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: RefObject<HTMLElement | null>;
  upCount: number;
  downCount: number;
}

export function CommentVotersPopover({
  electionId,
  commentId,
  open,
  onOpenChange,
  anchorRef,
  upCount,
  downCount,
}: CommentVotersPopoverProps) {
  const [voters, setVoters] = useState<CommentVoter[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVoters(null);
    setError(null);

    api.elections.comments.voters(electionId, commentId).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err || !data) setError(err ?? 'Не вдалося завантажити список');
      else setVoters(data.voters);
    });

    return () => {
      cancelled = true;
    };
  }, [open, electionId, commentId]);

  return (
    <Popover open={open} onOpenChange={onOpenChange} anchorRef={anchorRef} width={280}>
      <div className="border-border-color flex items-center justify-between border-b px-3 py-2">
        <span className="font-body text-sm font-semibold">Хто оцінив</span>
        <span className="text-muted-foreground flex items-center gap-2 text-xs">
          <span className="text-success flex items-center gap-0.5">
            <ThumbsUp className="h-3 w-3" /> {upCount}
          </span>
          <span className="text-error flex items-center gap-0.5">
            <ThumbsDown className="h-3 w-3" /> {downCount}
          </span>
        </span>
      </div>
      <div className="max-h-80 overflow-y-auto py-1">
        {error && <p className="text-error px-3 py-2 text-sm">{error}</p>}
        {!error && voters === null && (
          <p className="text-muted-foreground px-3 py-2 text-sm">Завантаження…</p>
        )}
        {!error && voters?.length === 0 && (
          <p className="text-muted-foreground px-3 py-2 text-sm">Ще ніхто не оцінив</p>
        )}
        {voters?.map((voter) => (
          <div key={voter.userId} className="hover:bg-hover-bg flex items-start gap-2 px-3 py-2">
            <Avatar src={voter.avatarUrl} name={voter.fullName} size={16} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-body truncate text-sm">{voter.fullName}</span>
                {voter.value === 'UP' ? (
                  <ThumbsUp className="text-success h-3 w-3 shrink-0" fill="currentColor" />
                ) : (
                  <ThumbsDown className="text-error h-3 w-3 shrink-0" fill="currentColor" />
                )}
              </div>
              <LocalDateTime date={voter.votedAt} className="text-muted-foreground text-xs" />
            </div>
          </div>
        ))}
      </div>
    </Popover>
  );
}
