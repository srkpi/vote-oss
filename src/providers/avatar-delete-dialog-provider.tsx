'use client';

import { Trash2 } from 'lucide-react';
import { createContext, useCallback, useContext, useState } from 'react';

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
import { setAvatar } from '@/lib/avatar-store';

interface DeleteTarget {
  userId: string;
  fullName: string;
}

interface AvatarDeleteDialogContextValue {
  requestDelete: (target: DeleteTarget) => void;
}

const AvatarDeleteDialogContext = createContext<AvatarDeleteDialogContextValue | null>(null);

export function useAvatarDeleteDialog(): AvatarDeleteDialogContextValue {
  const ctx = useContext(AvatarDeleteDialogContext);
  if (!ctx) {
    throw new Error('useAvatarDeleteDialog must be used within AvatarDeleteDialogProvider');
  }
  return ctx;
}

/**
 * Mounts a single confirmation dialog for the whole app. `UserAvatarMenu`
 * instances call `requestDelete` instead of owning their own `Dialog` — with
 * potentially dozens of avatars on a page (ballots, petition signatories,
 * admin lists), one shared dialog means one set of effects/listeners
 * instead of one per row.
 */
export function AvatarDeleteDialogProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  const requestDelete = useCallback((t: DeleteTarget) => setTarget(t), []);

  const close = useCallback(() => {
    if (!deleting) setTarget(null);
  }, [deleting]);

  const handleConfirm = async () => {
    if (!target) return;
    setDeleting(true);
    const result = await api.users.avatar.remove(target.userId);
    setDeleting(false);
    if (result.success) {
      setAvatar(target.userId, null);
      toast({ title: 'Аватар видалено', variant: 'success' });
      setTarget(null);
    } else {
      toast({ title: 'Не вдалося видалити аватар', description: result.error, variant: 'error' });
    }
  };

  return (
    <AvatarDeleteDialogContext.Provider value={{ requestDelete }}>
      {children}
      <Dialog open={!!target} onClose={close}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Видалити аватар?</DialogTitle>
            <DialogCloseButton onClose={close} />
          </DialogHeader>
          <DialogBody>
            <p className="font-body text-muted-foreground text-sm">
              Фото профілю користувача{' '}
              <strong className="text-foreground">{target?.fullName}</strong> буде видалено.
              Користувач зможе завантажити нове самостійно.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={close} disabled={deleting}>
              Скасувати
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirm}
              loading={deleting}
              icon={<Trash2 className="h-4 w-4" />}
            >
              Видалити
            </Button>
          </DialogFooter>
        </DialogPanel>
      </Dialog>
    </AvatarDeleteDialogContext.Provider>
  );
}
