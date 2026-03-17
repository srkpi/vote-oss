'use client';

import { useState } from 'react';

import { AdminMobileCard } from '@/components/admin/admin-mobile-card';
import { AdminRow } from '@/components/admin/admin-row';
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
  onDelete: (userId: string) => void;
}

export function AdminTable({ admins, currentUserId, onDelete }: AdminTableProps) {
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<Admin | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    const result = await api.deleteAdmin(deleteTarget.user_id);
    if (result.success) {
      toast({
        title: 'Адміністратора видалено',
        description: `${deleteTarget.full_name} більше не є адміністратором.`,
        variant: 'success',
      });
      onDelete(deleteTarget.user_id);
      setDeleteTarget(null);
    } else {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
    }
    setDeleting(false);
  };

  if (admins.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--muted-foreground)] font-body text-sm">
        Адміністраторів не знайдено
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              {['Користувач', 'Підрозділ', 'Група', 'Призначено', 'Права', ''].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider font-body"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {admins.map((admin) => (
              <AdminRow
                key={admin.user_id}
                admin={admin}
                isCurrentUser={admin.user_id === currentUserId}
                onDelete={() => setDeleteTarget(admin)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {admins.map((admin) => (
          <AdminMobileCard
            key={admin.user_id}
            admin={admin}
            isCurrentUser={admin.user_id === currentUserId}
            onDelete={() => setDeleteTarget(admin)}
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
              <strong>{deleteTarget?.full_name}</strong> втратить доступ до адмін-панелі.
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
    </>
  );
}
