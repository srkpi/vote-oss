'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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

interface LeaveAdminDialogProps {
  open: boolean;
  onClose: () => void;
  admins: Admin[];
  currentUserId: string;
}

/** BFS to collect all active descendants of `rootId` from the admins list. */
function getDescendants(admins: Admin[], rootId: string): Admin[] {
  const childrenMap: Record<string, string[]> = {};
  for (const admin of admins) {
    if (admin.promoter) {
      if (!childrenMap[admin.promoter.userId]) childrenMap[admin.promoter.userId] = [];
      childrenMap[admin.promoter.userId].push(admin.userId);
    }
  }

  const descendants: string[] = [];
  const queue = [...(childrenMap[rootId] ?? [])];
  while (queue.length) {
    const id = queue.shift()!;
    descendants.push(id);
    queue.push(...(childrenMap[id] ?? []));
  }

  const descSet = new Set(descendants);
  return admins.filter((a) => descSet.has(a.userId));
}

export function LeaveAdminDialog({ open, onClose, admins, currentUserId }: LeaveAdminDialogProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replacementId, setReplacementId] = useState('');

  const descendants = getDescendants(admins, currentUserId);
  const hasDescendants = descendants.length > 0;
  const canLeave = !hasDescendants || !!replacementId;

  const handleLeave = async () => {
    setLoading(true);
    setError(null);

    const result = await api.admins.leave(hasDescendants ? replacementId : null);

    if (result.success) {
      // Refresh the session so isAdmin is cleared in the JWT
      await api.auth.refresh();
      toast({
        title: 'Ви покинули платформу',
        description: 'Ваші права адміністратора знято.',
        variant: 'success',
        duration: 4000,
      });
      router.push('/');
      router.refresh();
    } else {
      setError(result.error);
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setError(null);
    setReplacementId('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogPanel maxWidth="sm">
        <DialogHeader>
          <DialogTitle>Покинути платформу</DialogTitle>
          <DialogCloseButton onClose={handleClose} />
        </DialogHeader>

        <DialogBody className="space-y-4">
          {error && (
            <Alert variant="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          {hasDescendants ? (
            <>
              <Alert variant="warning">
                У вашій ієрархії є підлеглі адміністратори. Оберіть наступника — він займе ваше
                місце в ієрархії.
              </Alert>

              <div className="space-y-2">
                <label
                  htmlFor="replacement"
                  className="font-body text-foreground block text-sm font-medium"
                >
                  Наступник{' '}
                  <span className="text-error" aria-hidden="true">
                    *
                  </span>
                </label>
                <select
                  id="replacement"
                  value={replacementId}
                  onChange={(e) => setReplacementId(e.target.value)}
                  className="border-border-color focus:ring-kpi-blue-light/20 focus:border-kpi-blue-light w-full rounded-(--radius) border bg-white px-3 py-2.5 text-sm transition-colors focus:ring-2 focus:outline-none"
                >
                  <option value="">Оберіть адміністратора…</option>
                  {descendants.map((admin) => (
                    <option key={admin.userId} value={admin.userId}>
                      {admin.fullName} · {admin.faculty}, {admin.group}
                    </option>
                  ))}
                </select>
                <p className="font-body text-muted-foreground text-xs">
                  Наступник стане безпосереднім батьком усіх ваших підлеглих
                </p>
              </div>
            </>
          ) : (
            <Alert variant="warning">
              Ви втратите права адміністратора та доступ до адмін-панелі. Повернутись можна лише за
              новим запрошенням.
            </Alert>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Скасувати
          </Button>
          <Button
            variant="danger"
            onClick={handleLeave}
            loading={loading}
            disabled={!canLeave}
            icon={<LogOut className="h-4 w-4" />}
          >
            Покинути платформу
          </Button>
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
}
