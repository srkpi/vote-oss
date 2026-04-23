'use client';

import { useState } from 'react';

import { AdminMobileCard } from '@/components/admin/admin-mobile-card';
import { AdminRow } from '@/components/admin/admin-row';
import { EditPermissionsDialog } from '@/components/admin/edit-permissions-dialog';
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
import type { Admin } from '@/types/admin';

interface AdminTableProps {
  admins: Admin[];
  currentUserId: string;
  canManageAdmins: boolean;
  callerRestrictedToFaculty: boolean;
  callerManageGroups: boolean;
  callerManagePetitions: boolean;
  onDelete: (userId: string) => void;
  onUpdate: (
    userId: string,
    updates: {
      manageAdmins: boolean;
      manageGroups: boolean;
      managePetitions: boolean;
      restrictedToFaculty: boolean;
    },
  ) => void;
}

export function AdminTable({
  admins,
  currentUserId,
  canManageAdmins,
  callerRestrictedToFaculty,
  callerManageGroups,
  callerManagePetitions,
  onDelete,
  onUpdate,
}: AdminTableProps) {
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<Admin | null>(null);
  const [editTarget, setEditTarget] = useState<Admin | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    const result = await api.admins.delete(deleteTarget.userId);
    if (result.success) {
      toast({
        title: 'Адміністратора видалено',
        description: `${deleteTarget.fullName} більше не є адміністратором.`,
        variant: 'success',
      });
      onDelete(deleteTarget.userId);
      setDeleteTarget(null);
    } else {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
    }
    setDeleting(false);
  };

  if (admins.length === 0) {
    return (
      <div className="font-body text-muted-foreground py-12 text-center text-sm">
        Адміністраторів не знайдено
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead>
            <tr className="border-border-subtle border-b">
              {['Користувач', 'Підрозділ', 'Група', 'Призначено', 'Права', ''].map((h) => (
                <th
                  key={h}
                  className="font-body text-muted-foreground px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border-subtle divide-y">
            {admins.map((admin) => (
              <AdminRow
                key={admin.userId}
                admin={admin}
                isCurrentUser={admin.userId === currentUserId}
                canManageAdmins={canManageAdmins}
                onDelete={() => setDeleteTarget(admin)}
                onEdit={() => setEditTarget(admin)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {admins.map((admin) => (
          <AdminMobileCard
            key={admin.userId}
            admin={admin}
            isCurrentUser={admin.userId === currentUserId}
            canManageAdmins={canManageAdmins}
            onDelete={() => setDeleteTarget(admin)}
            onEdit={() => setEditTarget(admin)}
          />
        ))}
      </div>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Видалити адміністратора?</DialogTitle>
            <DialogCloseButton onClose={() => setDeleteTarget(null)} />
          </DialogHeader>
          <DialogBody>
            <Alert variant="warning">
              <strong>{deleteTarget?.fullName}</strong> втратить доступ до адмін-панелі.
            </Alert>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Скасувати
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              Видалити
            </Button>
          </DialogFooter>
        </DialogPanel>
      </Dialog>

      {editTarget && (
        <EditPermissionsDialog
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          admin={editTarget}
          callerRestrictedToFaculty={callerRestrictedToFaculty}
          callerManageGroups={callerManageGroups}
          callerManagePetitions={callerManagePetitions}
          onUpdate={(userId, updates) => {
            onUpdate(userId, updates);
            setEditTarget(null);
          }}
        />
      )}
    </>
  );
}
