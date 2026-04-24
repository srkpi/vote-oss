'use client';

import { LogOut, Users } from 'lucide-react';
import { useState } from 'react';

import { AdminTable } from '@/components/admin/admin-table';
import { InviteAdminDialog } from '@/components/admin/invite/invite-admin-dialog';
import { LeaveAdminDialog } from '@/components/admin/leave-admin-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { pluralize } from '@/lib/utils/common';
import type { Admin } from '@/types/admin';
import type { User } from '@/types/auth';

interface AdminsPageClientProps {
  initialAdmins: Admin[];
  currentUser: User | null;
  canInvite: boolean;
  canGrantManageAdmins: boolean;
  canGrantManageGroups: boolean;
  canGrantManagePetitions: boolean;
  canGrantManageFaq: boolean;
  restrictedToFaculty: boolean;
  error: string | null;
}

export function AdminsPageClient({
  initialAdmins,
  currentUser,
  canInvite,
  canGrantManageAdmins,
  canGrantManageGroups,
  canGrantManagePetitions,
  canGrantManageFaq,
  restrictedToFaculty,
  error,
}: AdminsPageClientProps) {
  const [admins, setAdmins] = useState<Admin[]>(initialAdmins);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const handleDelete = (userId: string) => {
    setAdmins((prev) => prev.filter((a) => a.userId !== userId));
  };

  const handleUpdate = (
    userId: string,
    updates: {
      manageAdmins: boolean;
      manageGroups: boolean;
      managePetitions: boolean;
      manageFaq: boolean;
      restrictedToFaculty: boolean;
    },
  ) => {
    setAdmins((prev) =>
      prev.map((a) =>
        a.userId === userId
          ? {
              ...a,
              manageAdmins: updates.manageAdmins,
              manageGroups: updates.manageGroups,
              managePetitions: updates.managePetitions,
              manageFaq: updates.manageFaq,
              restrictedToFaculty: updates.restrictedToFaculty,
            }
          : a,
      ),
    );
  };

  const adminsCount = admins.length;
  const restrictedCount = admins.filter((a) => a.restrictedToFaculty).length;
  const canInviteCount = admins.filter((a) => a.manageAdmins).length;
  const manageGroupsCount = admins.filter((a) => a.manageGroups).length;
  const managePetitionsCount = admins.filter((a) => a.managePetitions).length;
  const manageFaqCount = admins.filter((a) => a.manageFaq).length;

  return (
    <div className="border-border-color shadow-shadow-card overflow-hidden rounded-xl border bg-white">
      <div className="border-border-subtle flex items-center justify-between border-b px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="navy-gradient flex h-8 w-8 items-center justify-center rounded-lg">
            <Users className="h-4 w-4 text-white" />
          </div>
          <h2 className="font-display text-foreground text-base font-semibold sm:text-lg">
            Список адміністраторів
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLeaveOpen(true)}
            className="text-error hover:bg-error-bg"
            icon={<LogOut className="h-3.5 w-3.5" />}
          >
            <span className="hidden sm:inline">Видалитись</span>
          </Button>
        </div>
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
            <span className="text-muted-foreground text-sm whitespace-nowrap">
              <strong className="text-foreground font-bold">{adminsCount}</strong>{' '}
              {pluralize(
                adminsCount,
                ['адміністратор', 'адміністратори', 'адміністраторів'],
                false,
              )}
            </span>
            <span className="text-muted-foreground text-sm whitespace-nowrap">
              <strong className="text-foreground font-bold">{canInviteCount}</strong> керує адмінами
            </span>
            <span className="text-muted-foreground text-sm whitespace-nowrap">
              <strong className="text-foreground font-bold">{manageGroupsCount}</strong> керує
              групами
            </span>
            <span className="text-muted-foreground text-sm whitespace-nowrap">
              <strong className="text-foreground font-bold">{managePetitionsCount}</strong> керує
              петиціями
            </span>
            <span className="text-muted-foreground text-sm whitespace-nowrap">
              <strong className="text-foreground font-bold">{manageFaqCount}</strong> редагує FAQ
            </span>
            <span className="text-muted-foreground text-sm whitespace-nowrap">
              <strong className="text-foreground font-bold">{restrictedCount}</strong>{' '}
              {pluralize(restrictedCount, ['обмежений', 'обмежені', 'обмежених'], false)}
            </span>
          </div>

          <AdminTable
            admins={admins}
            currentUserId={currentUser.userId}
            canManageAdmins={canGrantManageAdmins}
            callerRestrictedToFaculty={restrictedToFaculty}
            callerManageGroups={canGrantManageGroups}
            callerManagePetitions={canGrantManagePetitions}
            callerManageFaq={canGrantManageFaq}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
          />
        </div>
      )}

      {canInvite && (
        <InviteAdminDialog
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          canGrantManageAdmins={canGrantManageAdmins}
          canGrantManageGroups={canGrantManageGroups}
          canGrantManagePetitions={canGrantManagePetitions}
          canGrantManageFaq={canGrantManageFaq}
          restrictedToFaculty={restrictedToFaculty}
        />
      )}

      {currentUser && (
        <LeaveAdminDialog
          open={leaveOpen}
          onClose={() => setLeaveOpen(false)}
          admins={admins}
          currentUserId={currentUser.userId}
        />
      )}
    </div>
  );
}
