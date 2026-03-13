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
import { deleteElection } from '@/lib/api-client';

interface DeleteElectionButtonProps {
  electionId: string;
  electionTitle: string;
}

export function DeleteElectionButton({ electionId, electionTitle }: DeleteElectionButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const result = await deleteElection(electionId);

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
        className="text-[var(--error)] hover:bg-[var(--error-bg)]"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Видалити</span>
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Видалити голосування?</DialogTitle>
            <DialogCloseButton onClose={() => setOpen(false)} />
          </DialogHeader>
          <DialogBody>
            <Alert variant="warning">
              Голосування <strong className="break-words">«{electionTitle}»</strong> та всі
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
