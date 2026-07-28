'use client';

import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useRef, useState } from 'react';

import { CommentVotersPopover } from '@/components/comments/comment-voters-popover';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import { cn } from '@/lib/utils/common';
import type { CommentVoteSummary } from '@/types/comment';

interface CommentVoteButtonsProps {
  electionId: string;
  commentId: string;
  upCount: number;
  downCount: number;
  myVote: 'UP' | 'DOWN' | null;
  isOwnComment: boolean;
  onVoteChange: (next: CommentVoteSummary) => void;
}

export function CommentVoteButtons({
  electionId,
  commentId,
  upCount,
  downCount,
  myVote,
  isOwnComment,
  onVoteChange,
}: CommentVoteButtonsProps) {
  const [pending, setPending] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const { toast } = useToast();

  const castVote = async (value: 'UP' | 'DOWN') => {
    if (pending || isOwnComment) return;
    setPending(true);
    try {
      const result =
        myVote === value
          ? await api.elections.comments.revokeVote(electionId, commentId)
          : await api.elections.comments.vote(electionId, commentId, value);
      if (result.error || !result.data) throw new Error(result.error ?? 'Не вдалося проголосувати');
      onVoteChange(result.data);
    } catch (err) {
      toast({
        title: 'Не вдалося проголосувати',
        description: err instanceof Error ? err.message : 'Спробуйте ще раз',
        variant: 'error',
      });
    } finally {
      setPending(false);
    }
  };

  const disabledTitle = isOwnComment ? 'Не можна оцінювати власний коментар' : undefined;
  const hasVoters = upCount > 0 || downCount > 0;

  return (
    <div className="flex items-center gap-1 text-sm">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => castVote('UP')}
        disabled={isOwnComment || pending}
        title={disabledTitle}
        aria-pressed={myVote === 'UP'}
        className={cn(
          myVote === 'UP'
            ? 'text-success hover:text-success'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <ThumbsUp fill={myVote === 'UP' ? 'currentColor' : 'none'} />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        ref={anchorRef}
        onClick={() => hasVoters && setPopoverOpen((o) => !o)}
        disabled={!hasVoters}
        className="text-muted-foreground hover:text-foreground px-2 tabular-nums"
      >
        {upCount}
        <span className="text-border-color">·</span>
        {downCount}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => castVote('DOWN')}
        disabled={isOwnComment || pending}
        title={disabledTitle}
        aria-pressed={myVote === 'DOWN'}
        className={cn(
          myVote === 'DOWN'
            ? 'text-error hover:text-error'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <ThumbsDown fill={myVote === 'DOWN' ? 'currentColor' : 'none'} />
      </Button>

      <CommentVotersPopover
        electionId={electionId}
        commentId={commentId}
        open={popoverOpen}
        onOpenChange={setPopoverOpen}
        anchorRef={anchorRef}
        upCount={upCount}
        downCount={downCount}
      />
    </div>
  );
}
