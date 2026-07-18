'use client';

import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Avatar, type AvatarShape } from '@/components/ui/avatar';
import { useAvatar } from '@/hooks/use-avatar';
import { primeAvatars } from '@/lib/avatar-store';
import { cn } from '@/lib/utils/common';
import { useAvatarDeleteDialog } from '@/providers/avatar-delete-dialog-provider';

interface UserAvatarMenuProps {
  userId: string;
  fullName: string;
  avatarUrl?: string | null;
  icon?: boolean;
  size?: number;
  shape?: AvatarShape;
  /** Whether the current viewer may delete this person's avatar (e.g. `session.isAdmin`). */
  canDelete: boolean;
  className?: string;
  /** Optional extra bookkeeping after a successful delete; the avatar itself
   *  updates everywhere automatically via the shared cache. */
  onDeleted?: () => void;
}

/**
 * Renders a plain `Avatar` for regular viewers. For viewers who may moderate
 * (admins), clicking the avatar opens a small menu with a "remove avatar"
 * action, which hands off to the single app-wide confirmation dialog
 * (`AvatarDeleteDialogProvider`) rather than mounting its own.
 */
export function UserAvatarMenu({
  userId,
  fullName,
  avatarUrl,
  icon = false,
  size = 36,
  shape = 'circle',
  canDelete,
  className,
  onDeleted,
}: UserAvatarMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { requestDelete } = useAvatarDeleteDialog();
  const displayAvatarUrl = useAvatar(userId, avatarUrl ?? null);

  // Hydrate the shared cache with whatever we already know (server data or a
  // decrypted ballot's voter), without clobbering a fresher value — e.g. one
  // just deleted elsewhere on the same page.
  useEffect(() => {
    primeAvatars([[userId, avatarUrl ?? null]]);
  }, [userId, avatarUrl]);

  if (!canDelete || !displayAvatarUrl) {
    return (
      <Avatar
        src={displayAvatarUrl}
        name={fullName}
        icon={icon}
        size={size}
        shape={shape}
        className={className}
      />
    );
  }

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className={cn('rounded-full transition-opacity hover:opacity-80', className)}
        title={fullName}
      >
        <Avatar src={displayAvatarUrl} name={fullName} icon={icon} size={size} shape={shape} />
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
                requestDelete({ userId, fullName });
                onDeleted?.();
              }}
              className="font-body text-error hover:bg-error-bg flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Видалити аватар
            </button>
          </div>
        </>
      )}
    </div>
  );
}
