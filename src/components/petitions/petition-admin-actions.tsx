'use client';

import { CheckCircle2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
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
  approved: boolean;
  canApprove: boolean;
  canDelete: boolean;
}

export function PetitionAdminActions({
  petitionId,
  approved,
  canApprove,
  canDelete,
}: PetitionAdminActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [approving, setApproving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleApprove = async () => {
    setApproving(true);
    const res = await api.elections.approve(petitionId);
    if (res.success) {
      toast({
        title: 'Петицію затверджено',
        description: 'Петиція активна на 1 місяць.',
        variant: 'success',
      });
      router.refresh();
    } else {
      toast({ title: 'Помилка', description: res.error, variant: 'error' });
    }
    setApproving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await api.elections.delete(petitionId);
    if (res.success) {
      toast({
        title: 'Петицію видалено',
        variant: 'success',
      });
      router.push('/admin/petitions');
      router.refresh();
    } else {
      toast({ title: 'Помилка', description: res.error, variant: 'error' });
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <Alert variant="info">Адмін-дії</Alert>
      <div className="flex flex-wrap gap-2">
        {canApprove && !approved && (
          <Button
            variant="accent"
            size="sm"
            loading={approving}
            onClick={handleApprove}
            icon={<CheckCircle2 className="h-4 w-4" />}
          >
            Затвердити
          </Button>
        )}
        {canDelete && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            icon={<Trash2 className="h-4 w-4" />}
          >
            Видалити
          </Button>
        )}
      </div>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Видалити петицію?</DialogTitle>
            <DialogCloseButton onClose={() => setDeleteOpen(false)} />
          </DialogHeader>
          <DialogBody>
            <Alert variant="warning">Цю дію неможливо скасувати.</Alert>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Скасувати
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              Видалити
            </Button>
          </DialogFooter>
        </DialogPanel>
      </Dialog>
    </div>
  );
}
