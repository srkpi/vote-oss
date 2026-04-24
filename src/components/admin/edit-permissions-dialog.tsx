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
  callerManagePetitions: boolean;
  callerManageFaq: boolean;
  onUpdate: (
    userId: string,
    updates: {
      manageAdmins: boolean;
      manageGroups: boolean;
      managePetitions: boolean;
      manageFaq: boolean;
      restrictedToFaculty: boolean;
    },
  ) => void;
}

export function EditPermissionsDialog({
  open,
  onClose,
  admin,
  callerRestrictedToFaculty,
  callerManageGroups,
  callerManagePetitions,
  callerManageFaq,
  onUpdate,
}: EditPermissionsDialogProps) {
  const { toast } = useToast();

  const [manageAdmins, setManageAdmins] = useState(admin.manageAdmins);
  const [manageGroups, setManageGroups] = useState(admin.manageGroups);
  const [managePetitions, setManagePetitions] = useState(admin.managePetitions);
  const [manageFaq, setManageFaq] = useState(admin.manageFaq);
  const [restrictedToFaculty, setRestrictedToFaculty] = useState(admin.restrictedToFaculty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges =
    manageAdmins !== admin.manageAdmins ||
    manageGroups !== admin.manageGroups ||
    managePetitions !== admin.managePetitions ||
    manageFaq !== admin.manageFaq ||
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
      managePetitions,
      manageFaq,
      restrictedToFaculty,
    });

    if (result.success) {
      onUpdate(admin.userId, {
        manageAdmins,
        manageGroups,
        managePetitions,
        manageFaq,
        restrictedToFaculty,
      });
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
    setManagePetitions(admin.managePetitions);
    setManageFaq(admin.manageFaq);
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
              label="Керування петиціями"
              description={
                !callerManagePetitions
                  ? 'Ви не можете надати цей дозвіл, оскільки самі його не маєте'
                  : 'Дозволяє апрувати петиції користувачів та видаляти петиції'
              }
              checked={managePetitions}
              onChange={setManagePetitions}
              disabled={!callerManagePetitions}
            />

            <ToggleField
              label="Редагування FAQ"
              description={
                !callerManageFaq
                  ? 'Ви не можете надати цей дозвіл, оскільки самі його не маєте'
                  : 'Дозволяє редагувати FAQ'
              }
              checked={manageFaq}
              onChange={setManageFaq}
              disabled={!callerManageFaq}
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
