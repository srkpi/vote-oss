'use client';

import { CheckCircle2, Lock, LockOpen, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';

interface PetitionAdminActionsProps {
  petitionId: string;
  canApprove: boolean;
  canDelete: boolean;
  canManageDiscussion: boolean;
  discussionClosed: boolean;
}

export function PetitionAdminActions({
  petitionId,
  canApprove,
  canDelete,
  canManageDiscussion,
  discussionClosed,
}: PetitionAdminActionsProps) {
  const [approving, setApproving] = useState(false);
  const [togglingDiscussion, setTogglingDiscussion] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  if (!canApprove && !canDelete && !canManageDiscussion) return null;

  const handleApprove = async () => {
    setApproving(true);
    try {
      const { error } = await api.elections.approve(petitionId);
      if (error) throw new Error(error);
      toast({ title: 'Петицію підтверджено' });
      router.refresh();
    } catch (err) {
      toast({
        title: 'Помилка',
        description: err instanceof Error ? err.message : 'Спробуйте ще раз',
        variant: 'error',
      });
    } finally {
      setApproving(false);
    }
  };

  const handleToggleDiscussion = async () => {
    setTogglingDiscussion(true);
    try {
      const { error } = discussionClosed
        ? await api.elections.comments.open(petitionId)
        : await api.elections.comments.close(petitionId);
      if (error) throw new Error(error);
      toast({ title: discussionClosed ? 'Обговорення відкрито' : 'Обговорення закрито' });
      router.refresh();
    } catch (err) {
      toast({
        title: 'Помилка',
        description: err instanceof Error ? err.message : 'Спробуйте ще раз',
        variant: 'error',
      });
    } finally {
      setTogglingDiscussion(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await api.elections.delete(petitionId);
      if (error) throw new Error(error);
      toast({ title: 'Петицію видалено' });
      setConfirmingDelete(false);
      router.push('/petitions');
    } catch (err) {
      toast({
        title: 'Помилка',
        description: err instanceof Error ? err.message : 'Спробуйте ще раз',
        variant: 'error',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="border-border-color shadow-card space-y-3 rounded-xl border bg-white p-6">
      <h2 className="font-body text-sm font-semibold">Дії адміністратора</h2>

      {canApprove && (
        <Button onClick={handleApprove} loading={approving} className="w-full">
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Підтвердити петицію
        </Button>
      )}

      {canManageDiscussion && (
        <Button
          onClick={handleToggleDiscussion}
          loading={togglingDiscussion}
          variant="secondary"
          className="w-full"
        >
          {discussionClosed ? (
            <LockOpen className="mr-2 h-4 w-4" />
          ) : (
            <Lock className="mr-2 h-4 w-4" />
          )}
          {discussionClosed ? 'Відкрити обговорення' : 'Закрити обговорення'}
        </Button>
      )}

      {canDelete && (
        <Button onClick={() => setConfirmingDelete(true)} variant="destructive" className="w-full">
          <Trash2 className="mr-2 h-4 w-4" />
          Видалити петицію
        </Button>
      )}

      <Dialog open={confirmingDelete} onClose={() => setConfirmingDelete(false)}>
        <DialogPanel>
          <DialogHeader>
            <DialogTitle>Видалити петицію?</DialogTitle>
            <DialogCloseButton onClose={() => setConfirmingDelete(false)} />
          </DialogHeader>
          <DialogBody>
            <p className="text-muted-foreground text-sm">
              Петицію можна буде відновити пізніше зі списку видалених.
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
