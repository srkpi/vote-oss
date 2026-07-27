'use client';

import { Pencil, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { CommentComposer } from '@/components/comments/comment-composer';
import { CommentVoteButtons } from '@/components/comments/comment-vote-buttons';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogCloseButton,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from '@/components/ui/dialog';
import { LocalDateTime } from '@/components/ui/local-time';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import { linkifyText } from '@/lib/utils/linkify';
import type { Comment } from '@/types/comment';

interface CommentItemProps {
  electionId: string;
  comment: Comment;
  discussionClosed: boolean;
  onUpdated: (comment: Comment) => void;
  onDeleted: (comment: Comment) => void;
}

export function CommentItem({
  electionId,
  comment,
  discussionClosed,
  onUpdated,
  onDeleted,
}: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  if (comment.deletedAt) {
    const tooltip = comment.deletedBy
      ? `Видалено: ${comment.deletedBy.fullName} • ${new Date(comment.deletedAt).toLocaleString('uk-UA')}`
      : undefined;

    return (
      <div className="text-muted-foreground flex items-center gap-2 py-3 pl-11" title={tooltip}>
        <Trash2 className="h-4 w-4 shrink-0" />
        <span className="font-body text-sm italic">Коментар видалено</span>
      </div>
    );
  }

  const handleEditSubmit = async (body: string) => {
    const { data, error } = await api.elections.comments.update(electionId, comment.id, body);
    if (error || !data) throw new Error(error ?? 'Не вдалося зберегти зміни');
    onUpdated(data);
    setEditing(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { data, error } = await api.elections.comments.remove(electionId, comment.id);
      if (error || !data) throw new Error(error ?? 'Не вдалося видалити коментар');
      onDeleted(data);
      setConfirmingDelete(false);
    } catch (err) {
      toast({
        title: 'Не вдалося видалити',
        description: err instanceof Error ? err.message : 'Спробуйте ще раз',
        variant: 'error',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex gap-3 py-3">
      <Avatar src={comment.author.avatarUrl} name={comment.author.fullName} size={16} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-body text-sm font-semibold">{comment.author.fullName}</span>
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
          <LocalDateTime date={comment.createdAt} className="text-muted-foreground text-xs" />
          {comment.editedAt && (
            <span
              className="text-muted-foreground flex items-center gap-0.5 text-xs"
              title={`Відредаговано ${new Date(comment.editedAt).toLocaleString('uk-UA')}`}
            >
              <Pencil className="h-3 w-3" />
              змінено
            </span>
          )}
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
          <div className="font-body text-sm whitespace-pre-wrap">{linkifyText(comment.body)}</div>
        )}

        <div className="flex items-center gap-4 pt-0.5">
          <CommentVoteButtons
            electionId={electionId}
            commentId={comment.id}
            upCount={comment.upCount}
            downCount={comment.downCount}
            myVote={comment.myVote}
            isOwnComment={comment.canEdit}
            onVoteChange={(next) => onUpdated({ ...comment, ...next })}
          />
          {!editing && comment.canEdit && !discussionClosed && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
            >
              <Pencil className="h-3 w-3" />
              Редагувати
            </button>
          )}
          {comment.canDelete && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="hover:text-error text-muted-foreground flex items-center gap-1 text-xs"
            >
              <Trash2 className="h-3 w-3" />
              Видалити
            </button>
          )}
        </div>
      </div>

      <Dialog open={confirmingDelete} onClose={() => setConfirmingDelete(false)}>
        <DialogPanel>
          <DialogHeader>
            <DialogTitle>Видалити коментар?</DialogTitle>
            <DialogCloseButton onClose={() => setConfirmingDelete(false)} />
          </DialogHeader>
          <DialogBody>
            <p className="font-body text-muted-foreground text-sm">
              Текст коментаря буде прибрано, але запис про його видалення залишиться видимим.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
              Скасувати
            </Button>
            <Button variant="destructive" onClick={handleDelete} loading={deleting}>
              Видалити
            </Button>
          </DialogFooter>
        </DialogPanel>
      </Dialog>
    </div>
  );
}
