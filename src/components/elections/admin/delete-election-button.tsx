'use client';

import { Trash2 } from 'lucide-react';
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

interface DeleteElectionButtonProps {
  electionId: string;
  electionTitle: string;
  hiddenLabel?: boolean;
}

export function DeleteElectionButton({
  electionId,
  electionTitle,
  hiddenLabel,
}: DeleteElectionButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const result = await api.elections.delete(electionId);

    if (result.success) {
      toast({
        title: 'Голосування видалено',
        description: `«${electionTitle}» було успішно видалено.`,
        variant: 'success',
      });
      router.push('/admin/elections');
      router.refresh();
    } else {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
      setDeleting(false);
      setOpen(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-error hover:bg-error-bg"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {!hiddenLabel && <span className="hidden sm:inline">Видалити</span>}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Видалити голосування?</DialogTitle>
            <DialogCloseButton onClose={() => setOpen(false)} />
          </DialogHeader>
          <DialogBody>
            <Alert variant="warning">
              Голосування <strong className="wrap-break-word">«{electionTitle}»</strong> та всі
              пов&apos;язані бюлетені будуть видалені. Цю дію неможливо скасувати.
            </Alert>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={deleting}>
              Скасувати
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              Видалити
            </Button>
          </DialogFooter>
        </DialogPanel>
      </Dialog>
    </>
  );
}
