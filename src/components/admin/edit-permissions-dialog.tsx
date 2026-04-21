'use client';

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
import { ToggleField } from '@/components/ui/toggle-field';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import type { Admin } from '@/types/admin';

interface EditPermissionsDialogProps {
  open: boolean;
  onClose: () => void;
  admin: Admin;
  callerRestrictedToFaculty: boolean;
  callerManageGroups: boolean;
  onUpdate: (
    userId: string,
    updates: { manageAdmins: boolean; manageGroups: boolean; restrictedToFaculty: boolean },
  ) => void;
}

export function EditPermissionsDialog({
  open,
  onClose,
  admin,
  callerRestrictedToFaculty,
  callerManageGroups,
  onUpdate,
}: EditPermissionsDialogProps) {
  const { toast } = useToast();

  const [manageAdmins, setManageAdmins] = useState(admin.manageAdmins);
  const [manageGroups, setManageGroups] = useState(admin.manageGroups);
  const [restrictedToFaculty, setRestrictedToFaculty] = useState(admin.restrictedToFaculty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges =
    manageAdmins !== admin.manageAdmins ||
    manageGroups !== admin.manageGroups ||
    restrictedToFaculty !== admin.restrictedToFaculty;

  const handleSubmit = async () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    setLoading(true);
    setError(null);

    const result = await api.admins.patch(admin.userId, {
      manageAdmins,
      manageGroups,
      restrictedToFaculty,
    });

    if (result.success) {
      onUpdate(admin.userId, { manageAdmins, manageGroups, restrictedToFaculty });
      toast({
        title: 'Права оновлено',
        description: `Права адміністратора ${admin.fullName} успішно змінено.`,
        variant: 'success',
      });
      handleClose();
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const handleClose = () => {
    if (loading) return;
    setError(null);
    setManageAdmins(admin.manageAdmins);
    setManageGroups(admin.manageGroups);
    setRestrictedToFaculty(admin.restrictedToFaculty);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogPanel maxWidth="sm">
        <DialogHeader>
          <DialogTitle>Змінити права: {admin.fullName}</DialogTitle>
          <DialogCloseButton onClose={handleClose} />
        </DialogHeader>

        <DialogBody className="space-y-5">
          {error && (
            <Alert variant="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          <div className="space-y-3">
            <ToggleField
              label="Керування адміністраторами"
              description="Дозволяє запрошувати нових адміністраторів та видаляти підлеглих"
              checked={manageAdmins}
              onChange={setManageAdmins}
            />

            <ToggleField
              label="Керування групами"
              description={
                !callerManageGroups
                  ? 'Ви не можете надати цей дозвіл, оскільки самі його не маєте'
                  : 'Дозволяє переглядати, видаляти групи та видаляти їх учасників'
              }
              checked={manageGroups}
              onChange={setManageGroups}
              disabled={!callerManageGroups}
            />

            <ToggleField
              label="Обмежений до підрозділу"
              description={
                callerRestrictedToFaculty
                  ? 'Ви не можете зняти це обмеження, оскільки самі обмежені до підрозділу'
                  : 'Адміністратор зможе керувати ресурсами лише свого підрозділу'
              }
              checked={restrictedToFaculty}
              onChange={setRestrictedToFaculty}
              disabled={callerRestrictedToFaculty}
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Скасувати
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading} disabled={!hasChanges}>
            Зберегти зміни
          </Button>
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
}
