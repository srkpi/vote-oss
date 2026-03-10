'use client';

import { useState, useMemo } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { AdminTable } from '@/components/admin/admin-table';
import { InviteAdminDialog } from '@/components/admin/invite-admin-dialog';
import type { Admin, User } from '@/types';

interface AdminsPageClientProps {
  initialAdmins: Admin[];
  currentUser: User | null;
  canInvite: boolean;
  canGrantManageAdmins: boolean;
  restrictedToFaculty: boolean;
  error: string | null;
}

function getDeletableIds(admins: Admin[], currentUserId: string): Set<string> {
  const deletable = new Set<string>();
  let changed = true;

  while (changed) {
    changed = false;
    for (const admin of admins) {
      if (deletable.has(admin.user_id)) continue;
      if (
        admin.promoted_by === currentUserId ||
        (admin.promoted_by !== null && deletable.has(admin.promoted_by))
      ) {
        deletable.add(admin.user_id);
        changed = true;
      }
    }
  }

  return deletable;
}

export function AdminsPageClient({
  initialAdmins,
  currentUser,
  canInvite,
  canGrantManageAdmins,
  restrictedToFaculty,
  error,
}: AdminsPageClientProps) {
  const [admins, setAdmins] = useState<Admin[]>(initialAdmins);
  const [inviteOpen, setInviteOpen] = useState(false);

  const deletableIds = useMemo(
    () => (currentUser ? getDeletableIds(admins, currentUser.userId) : new Set<string>()),
    [admins, currentUser],
  );

  const handleDelete = (userId: string) => {
    setAdmins((prev) => prev.filter((a) => a.user_id !== userId));
  };

  return (
    <div
      className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden animate-fade-up"
      style={{ animationDelay: '220ms', animationFillMode: 'both' }}
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--border-subtle)]">
        {/* Left side: icon + title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg navy-gradient flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <h2 className="font-display text-base sm:text-lg font-semibold text-[var(--foreground)]">
            Список адміністраторів
          </h2>
        </div>

        {/* Right side: Invite button */}
        {canGrantManageAdmins && (
          <div className="flex items-center gap-3">
            <Button
              variant="accent"
              size="sm"
              onClick={() => setInviteOpen(true)}
              icon={<UserPlus className="w-3.5 h-3.5" />}
            >
              Запросити адміна
            </Button>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 sm:p-6">
          <Alert variant="error" title="Помилка завантаження">
            {error}
          </Alert>
        </div>
      )}

      {!error && currentUser && (
        <div className="p-4 sm:p-6 space-y-5">
          <div className="flex items-center gap-4 text-sm font-body text-[var(--muted-foreground)] px-1">
            <span>
              <strong className="text-[var(--foreground)]">{admins.length}</strong> адміністратор
              {admins.length === 1 ? '' : admins.length < 5 ? 'и' : 'ів'}
            </span>
            <span>
              <strong className="text-[var(--foreground)]">
                {admins.filter((a) => a.manage_admins).length}
              </strong>{' '}
              з правом керування
            </span>
            <span>
              <strong className="text-[var(--foreground)]">
                {admins.filter((a) => a.restricted_to_faculty).length}
              </strong>{' '}
              обмежених до підрозділу
            </span>
          </div>
          <AdminTable
            admins={admins}
            currentUserId={currentUser.userId}
            deletableIds={deletableIds}
            onDelete={handleDelete}
          />
        </div>
      )}

      {canInvite && (
        <InviteAdminDialog
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          canGrantManageAdmins={canGrantManageAdmins}
          restrictedToFaculty={restrictedToFaculty}
        />
      )}
    </div>
  );
}
