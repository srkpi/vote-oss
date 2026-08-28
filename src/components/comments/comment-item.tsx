'use client';

import { Pencil, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { CommentComposer } from '@/components/comments/comment-composer';
import { CommentVoteButtons } from '@/components/comments/comment-vote-buttons';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LocalDateTime } from '@/components/ui/local-time';
import { Tooltip } from '@/components/ui/tooltip';
import { api } from '@/lib/api/browser';
import { linkifyText } from '@/lib/utils/linkify';
import type { Comment } from '@/types/comment';

interface CommentItemProps {
  electionId: string;
  comment: Comment;
  discussionClosed: boolean;
  onUpdated: (comment: Comment) => void;
  /** Opens the single shared delete-confirmation dialog in CommentSection. */
  onRequestDelete: (comment: Comment) => void;
}

export function CommentItem({
  electionId,
  comment,
  discussionClosed,
  onUpdated,
  onRequestDelete,
}: CommentItemProps) {
  const [editing, setEditing] = useState(false);

  if (comment.deletedAt) {
    return (
      <div className="border-border-color shadow-card rounded-xl border bg-white p-4 sm:p-5">
        <div className="flex gap-3">
          <Avatar
            src={comment.author.avatarUrl}
            name={comment.author.fullName}
            size={36}
            className="mt-0.5 opacity-60"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="font-body text-muted-foreground truncate text-sm font-semibold">
                  {comment.author.fullName}
                </span>
                {comment.isPetitionAuthor && (
                  <Badge variant="accent" className="text-xs">
                    Автор петиції
                  </Badge>
                )}
                {comment.isAdmin && (
                  <Badge variant="navy" className="text-xs">
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    Адміністратор
                  </Badge>
                )}
              </div>

              <div className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
                <LocalDateTime date={comment.createdAt} />
                {comment.deletedAt && (
                  <Tooltip content={<LocalDateTime date={comment.deletedAt} />}>
                    <span className="hover:text-foreground flex items-center gap-1 transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </span>
                  </Tooltip>
                )}
              </div>
            </div>

            <div className="font-body text-muted-foreground text-sm italic">Коментар видалено</div>
          </div>
        </div>
      </div>
    );
  }

  const handleEditSubmit = async (body: string) => {
    const { data, error } = await api.elections.comments.update(electionId, comment.id, body);
    if (error || !data) throw new Error(error ?? 'Не вдалося зберегти зміни');
    onUpdated(data);
    setEditing(false);
  };

  return (
    <div className="group border-border-color shadow-card hover:shadow-card-hover rounded-xl border bg-white p-4 transition-shadow sm:p-5">
      <div className="flex gap-3">
        <Avatar
          src={comment.author.avatarUrl}
          name={comment.author.fullName}
          size={36}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="font-body truncate text-sm font-semibold">
                {comment.author.fullName}
              </span>
              {comment.isPetitionAuthor && (
                <Badge variant="accent" className="text-xs">
                  Автор петиції
                </Badge>
              )}
              {comment.isAdmin && (
                <Badge variant="navy" className="text-xs">
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  Адміністратор
                </Badge>
              )}
            </div>

            <div className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
              <LocalDateTime date={comment.createdAt} />
              {comment.editedAt && (
                <Tooltip content={<LocalDateTime date={comment.editedAt} />}>
                  <span className="hover:text-foreground flex items-center transition-colors">
                    <Pencil className="h-3 w-3" />
                  </span>
                </Tooltip>
              )}
            </div>
          </div>

          {editing ? (
            <CommentComposer
              initialValue={comment.body}
              submitLabel="Зберегти"
              autoFocus
              onCancel={() => setEditing(false)}
              onSubmit={handleEditSubmit}
            />
          ) : (
            <div className="font-body text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
              {linkifyText(comment.body)}
            </div>
          )}

          <div className="flex items-center gap-1 pt-1 sm:gap-2">
            <CommentVoteButtons
              electionId={electionId}
              commentId={comment.id}
              upCount={comment.upCount}
              downCount={comment.downCount}
              myVote={comment.myVote}
              isOwnComment={comment.canEdit}
              onVoteChange={(next) => onUpdated({ ...comment, ...next })}
            />

            <div className="ml-auto flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              {!editing && comment.canEdit && !discussionClosed && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(true)}
                  className="text-muted-foreground hover:text-foreground gap-1 px-2 text-xs"
                >
                  <Pencil className="h-3 w-3" />
                  <span className="hidden sm:inline">Редагувати</span>
                </Button>
              )}
              {comment.canDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRequestDelete(comment)}
                  className="hover:text-error text-muted-foreground gap-1 px-2 text-xs"
                >
                  <Trash2 className="h-3 w-3" />
                  <span className="hidden sm:inline">Видалити</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
