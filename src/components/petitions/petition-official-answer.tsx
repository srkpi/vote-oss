'use client';

import { MessageSquareText, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { CommentComposer } from '@/components/comments/comment-composer';
import { Avatar } from '@/components/ui/avatar';
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
import { PETITION_OFFICIAL_ANSWER_MAX_LENGTH } from '@/lib/constants';
import { linkifyText } from '@/lib/utils/linkify';
import type { PetitionOfficialAnswer as PetitionOfficialAnswerType } from '@/types/comment';

interface PetitionOfficialAnswerProps {
  electionId: string;
  answer: PetitionOfficialAnswerType | null;
  canManage: boolean;
}

export function PetitionOfficialAnswer({
  electionId,
  answer,
  canManage,
}: PetitionOfficialAnswerProps) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  if (!answer && !canManage) return null;

  const handleSubmit = async (body: string) => {
    const { data, error } = await api.elections.officialAnswer.upsert(electionId, body);
    if (error || !data) throw new Error(error ?? 'Не вдалося зберегти відповідь');
    setEditing(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await api.elections.officialAnswer.remove(electionId);
      if (error) throw new Error(error);
      setConfirmingDelete(false);
    } catch (err) {
      toast({
        title: 'Не вдалося видалити відповідь',
        description: err instanceof Error ? err.message : 'Спробуйте ще раз',
        variant: 'error',
      });
    } finally {
      setDeleting(false);
    }
  };

  if (!answer) {
    return (
      <div className="border-border-color rounded-xl border border-dashed p-4">
        {editing ? (
          <CommentComposer
            placeholder="Офіційна відповідь адміністрації…"
            submitLabel="Опублікувати"
            maxLength={PETITION_OFFICIAL_ANSWER_MAX_LENGTH}
            autoFocus
            onCancel={() => setEditing(false)}
            onSubmit={handleSubmit}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm"
          >
            <MessageSquareText className="h-4 w-4" />
            Дати офіційну відповідь від імені адміністрації
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <MessageSquareText className="h-4 w-4" />
          Офіційна відповідь
        </div>
        {canManage && !editing && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="hover:bg-hover-bg text-muted-foreground hover:text-foreground rounded p-1"
              title="Редагувати відповідь"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="hover:bg-hover-bg hover:text-error text-muted-foreground rounded p-1"
              title="Видалити відповідь"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <CommentComposer
          initialValue={answer.body}
          submitLabel="Зберегти"
          maxLength={PETITION_OFFICIAL_ANSWER_MAX_LENGTH}
          autoFocus
          onCancel={() => setEditing(false)}
          onSubmit={handleSubmit}
        />
      ) : (
        <>
          <div className="font-body text-sm whitespace-pre-wrap">{linkifyText(answer.body)}</div>
          <div className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
            <Avatar src={answer.author.avatarUrl} name={answer.author.fullName} size={16} />
            <span>
              {answer.author.fullName} · <LocalDateTime date={answer.createdAt} />
            </span>
            {answer.editedBy && answer.editedAt && (
              <span title={`Востаннє редагував: ${answer.editedBy.fullName}`}>
                (відредаговано <LocalDateTime date={answer.editedAt} />)
              </span>
            )}
          </div>
        </>
      )}

      <Dialog open={confirmingDelete} onClose={() => setConfirmingDelete(false)}>
        <DialogPanel>
          <DialogHeader>
            <DialogTitle>Видалити офіційну відповідь?</DialogTitle>
            <DialogCloseButton onClose={() => setConfirmingDelete(false)} />
          </DialogHeader>
          <DialogBody>
            <p className="font-body text-muted-foreground text-sm">Цю дію не можна скасувати.</p>
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
