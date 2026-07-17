'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Avatar, type AvatarShape } from '@/components/ui/avatar';
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
import { cn } from '@/lib/utils/common';

interface UserAvatarMenuProps {
  userId: string;
  fullName: string;
  avatarUrl?: string | null;
  size?: number;
  shape?: AvatarShape;
  /** Whether the current viewer may delete this person's avatar (e.g. `session.isAdmin`). */
  canDelete: boolean;
  className?: string;
  /** Called after a successful delete so the parent list can update optimistically. */
  onDeleted?: () => void;
}

/**
 * Renders a plain `Avatar` for regular viewers. For viewers who may moderate
 * (admins), clicking the avatar opens a small menu with a "remove avatar"
 * action, which opens a confirmation dialog before actually deleting.
 */
export function UserAvatarMenu({
  userId,
  fullName,
  avatarUrl,
  size = 36,
  shape = 'circle',
  canDelete,
  className,
  onDeleted,
}: UserAvatarMenuProps) {
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!canDelete || !avatarUrl) {
    return (
      <Avatar src={avatarUrl} name={fullName} size={size} shape={shape} className={className} />
    );
  }

  const closeConfirm = () => {
    if (deleting) return;
    setConfirmOpen(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const result = await api.users.avatar.remove(userId);
    setDeleting(false);
    if (result.success) {
      toast({ title: 'Аватар видалено', variant: 'success' });
      setConfirmOpen(false);
      onDeleted?.();
    } else {
      toast({ title: 'Не вдалося видалити аватар', description: result.error, variant: 'error' });
    }
  };

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className={cn('rounded-full transition-opacity hover:opacity-80', className)}
        title={fullName}
      >
        <Avatar src={avatarUrl} name={fullName} size={size} shape={shape} />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div
            className={cn(
              'border-border-color absolute top-full left-0 z-50 mt-2 w-48',
              'shadow-shadow-xl origin-top-left overflow-hidden rounded-xl border bg-white',
            )}
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setConfirmOpen(true);
              }}
              className="font-body text-error hover:bg-error-bg flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Видалити аватар
            </button>
          </div>
        </>
      )}

      <Dialog open={confirmOpen} onClose={closeConfirm}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Видалити аватар?</DialogTitle>
            <DialogCloseButton onClose={closeConfirm} />
          </DialogHeader>
          <DialogBody>
            <p className="font-body text-muted-foreground text-sm">
              Фото профілю користувача <strong className="text-foreground">{fullName}</strong> буде
              видалено. Користувач зможе завантажити нове самостійно.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={closeConfirm} disabled={deleting}>
              Скасувати
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleting}
              icon={<Trash2 className="h-4 w-4" />}
            >
              Видалити
            </Button>
          </DialogFooter>
        </DialogPanel>
      </Dialog>
    </div>
  );
}
