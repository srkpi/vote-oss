'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogPanel,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseButton,
} from '@/components/ui/dialog';
import { Alert } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { deleteAdmin } from '@/lib/api-client';
import type { Admin } from '@/types';

interface AdminTableProps {
  admins: Admin[];
  currentUserId: string;
  deletableIds: Set<string>;
  onDelete: (userId: string) => void;
}

export function AdminTable({ admins, currentUserId, deletableIds, onDelete }: AdminTableProps) {
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<Admin | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    const result = await deleteAdmin(deleteTarget.user_id);
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
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              {['Користувач', 'Підрозділ', 'Група', 'Призначено', 'Права', 'Дії'].map((h) => (
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
                canDelete={deletableIds.has(admin.user_id)}
                onDelete={() => setDeleteTarget(admin)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {admins.map((admin) => (
          <AdminCard
            key={admin.user_id}
            admin={admin}
            isCurrentUser={admin.user_id === currentUserId}
            canDelete={deletableIds.has(admin.user_id)}
            onDelete={() => setDeleteTarget(admin)}
          />
        ))}
      </div>

      {/* Delete confirmation dialog */}
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

interface AdminRowProps {
  admin: Admin;
  isCurrentUser: boolean;
  canDelete: boolean;
  onDelete: () => void;
}

function AdminRow({ admin, isCurrentUser, canDelete, onDelete }: AdminRowProps) {
  return (
    <tr
      className={cn(
        'hover:bg-[var(--surface)] transition-colors duration-150',
        isCurrentUser && 'bg-[var(--kpi-blue-light)]/10',
      )}
    >
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full navy-gradient flex items-center justify-center text-white text-sm font-semibold shrink-0">
            {admin.full_name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--foreground)] font-body">
              {admin.full_name}
            </p>
            <p className="text-xs text-[var(--muted-foreground)] font-body">{admin.user_id}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <span className="text-sm font-body text-[var(--foreground)]">{admin.faculty}</span>
      </td>
      <td className="px-4 py-3.5">
        <span className="text-sm font-body text-[var(--foreground)]">{admin.group}</span>
      </td>
      <td className="px-4 py-3.5">
        <div>
          <p className="text-sm font-body text-[var(--foreground)]">
            {formatDate(admin.promoted_at)}
          </p>
          {admin.promoted_by && (
            <p className="text-xs text-[var(--muted-foreground)] font-body">{admin.promoted_by}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex flex-wrap gap-1.5">
          {admin.manage_admins && (
            <Badge variant="info" size="sm">
              Керування адмінами
            </Badge>
          )}
          {admin.restricted_to_faculty && (
            <Badge variant="warning" size="sm">
              Обмежений до підрозділу
            </Badge>
          )}
          {!admin.manage_admins && !admin.restricted_to_faculty && (
            <Badge variant="default" size="sm">
              Базові
            </Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-3.5">
        {!isCurrentUser && canDelete && (
          <Button
            variant="ghost"
            size="md"
            onClick={onDelete}
            className="text-[var(--error)] hover:bg-[var(--error-bg)]"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </td>
    </tr>
  );
}

function AdminCard({ admin, isCurrentUser, canDelete, onDelete }: AdminRowProps) {
  return (
    <div
      className={cn(
        'p-4 rounded-[var(--radius-lg)] border border-[var(--border-color)]',
        'bg-white shadow-[var(--shadow-sm)]',
        isCurrentUser && 'border-[var(--kpi-navy)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full navy-gradient flex items-center justify-center text-white font-semibold shrink-0">
            {admin.full_name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-[var(--foreground)] font-body">
                {admin.full_name}
              </p>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] font-body mt-0.5">
              {admin.faculty} · {admin.group}
            </p>
          </div>
        </div>
        {!isCurrentUser && canDelete && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onDelete}
            className="text-[var(--error)] hover:bg-[var(--error-bg)]"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {admin.manage_admins && (
          <Badge variant="info" size="sm">
            Керування адмінами
          </Badge>
        )}
        {admin.restricted_to_faculty && (
          <Badge variant="warning" size="sm">
            Обмежений до підрозділу
          </Badge>
        )}
      </div>

      <p className="text-xs text-[var(--muted-foreground)] font-body mt-2">
        Призначено: {formatDate(admin.promoted_at)}
      </p>
      {admin.promoted_by && (
        <p className="text-xs text-[var(--muted-foreground)] font-body">{admin.promoted_by}</p>
      )}
    </div>
  );
}
