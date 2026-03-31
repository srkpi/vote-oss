'use client';

import { RotateCcw } from 'lucide-react';
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

interface RestoreElectionButtonProps {
  electionId: string;
  electionTitle: string;
  onRestored?: () => void;
}

export function RestoreElectionButton({
  electionId,
  electionTitle,
  onRestored,
}: RestoreElectionButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handleRestore = async () => {
    setRestoring(true);
    const result = await api.elections.restore(electionId);

    if (result.success) {
      toast({
        title: 'Голосування відновлено',
        description: `«${electionTitle}» успішно відновлено.`,
        variant: 'success',
      });
      setOpen(false);
      onRestored?.();
      router.refresh();
    } else {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
      setRestoring(false);
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="text-kpi-navy">
        <RotateCcw className="h-4 w-4" />
        Відновити
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Відновити голосування?</DialogTitle>
            <DialogCloseButton onClose={() => setOpen(false)} />
          </DialogHeader>
          <DialogBody>
            <Alert variant="info">
              Голосування <strong className="wrap-break-word">«{electionTitle}»</strong> буде
              відновлено та стане видимим для студентів знову.
            </Alert>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={restoring}>
              Скасувати
            </Button>
            <Button variant="accent" onClick={handleRestore} loading={restoring}>
              Відновити
            </Button>
          </DialogFooter>
        </DialogPanel>
      </Dialog>
    </>
  );
}
