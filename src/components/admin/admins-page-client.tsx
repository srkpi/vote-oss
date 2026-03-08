'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AdminTable } from '@/components/admin/admin-table';
import { InviteAdminDialog } from '@/components/admin/invite-admin-dialog';
import type { Admin, User } from '@/types';

interface AdminsPageClientProps {
  initialAdmins: Admin[];
  currentUser: User;
  canInvite: boolean;
  canGrantManageAdmins: boolean;
}

export function AdminsPageClient({
  initialAdmins,
  currentUser,
  canInvite,
  canGrantManageAdmins,
}: AdminsPageClientProps) {
  const [admins, setAdmins] = useState<Admin[]>(initialAdmins);
  const [inviteOpen, setInviteOpen] = useState(false);

  const handleDelete = (userId: string) => {
    setAdmins((prev) => prev.filter((a) => a.user_id !== userId));
  };

  return (
    <>
      {/* Header action area */}
      {canInvite && (
        <div className="flex items-center gap-3">
          <Button
            variant="accent"
            size="sm"
            onClick={() => setInviteOpen(true)}
            icon={
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            }
          >
            Запросити адміна
          </Button>
        </div>
      )}

      {/* Admins count summary */}
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
          обмежених
        </span>
      </div>

      {/* Table */}
      <AdminTable admins={admins} currentUserId={currentUser.userId} onDelete={handleDelete} />

      {/* Invite dialog */}
      {canInvite && (
        <InviteAdminDialog
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          canGrantManageAdmins={canGrantManageAdmins}
        />
      )}
    </>
  );
}
