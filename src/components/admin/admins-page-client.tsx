'use client';

import { UserPlus, Users } from 'lucide-react';
import { useState } from 'react';

import { AdminTable } from '@/components/admin/admin-table';
import { InviteAdminDialog } from '@/components/admin/invite-admin-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { Admin } from '@/types/admin';
import type { User } from '@/types/auth';

interface AdminsPageClientProps {
  initialAdmins: Admin[];
  currentUser: User | null;
  canInvite: boolean;
  canGrantManageAdmins: boolean;
  restrictedToFaculty: boolean;
  error: string | null;
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

  const handleDelete = (userId: string) => {
    setAdmins((prev) => prev.filter((a) => a.userId !== userId));
  };

  return (
    <div className="overflow-hidden rounded-xl border border-(--border-color) bg-white shadow-(--shadow-card)">
      <div className="flex items-center justify-between border-b border-(--border-subtle) px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="navy-gradient flex h-8 w-8 items-center justify-center rounded-lg">
            <Users className="h-4 w-4 text-white" />
          </div>
          <h2 className="font-display text-base font-semibold text-(--foreground) sm:text-lg">
            Список адміністраторів
          </h2>
        </div>

        {canGrantManageAdmins && (
          <div className="flex items-center gap-3">
            <Button
              variant="accent"
              size="sm"
              onClick={() => setInviteOpen(true)}
              icon={<UserPlus className="h-3.5 w-3.5" />}
            >
              <span className="hidden sm:inline">Запросити адміна</span>
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 sm:p-6">
          <Alert variant="error" title="Помилка завантаження">
            {error}
          </Alert>
        </div>
      )}

      {!error && currentUser && (
        <div className="space-y-5 p-4 sm:p-6">
          <div className="font-body flex flex-col gap-2 px-1 text-sm text-(--muted-foreground) sm:flex-row sm:items-center sm:gap-4">
            <span>
              <strong className="text-(--foreground)">{admins.length}</strong> адміністратор
              {admins.length === 1 ? '' : admins.length < 5 ? 'и' : 'ів'}
            </span>
            <span>
              <strong className="text-(--foreground)">
                {admins.filter((a) => a.manageAdmins).length}
              </strong>{' '}
              з правом керування
            </span>
            <span>
              <strong className="text-(--foreground)">
                {admins.filter((a) => a.restrictedToFaculty).length}
              </strong>{' '}
              обмежених до підрозділу
            </span>
          </div>
          <AdminTable admins={admins} currentUserId={currentUser.userId} onDelete={handleDelete} />
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
