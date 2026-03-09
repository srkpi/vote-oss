'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form';
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
import { ToggleField } from '@/components/ui/toggle-field';
import { TokenResult } from '@/components/admin/token-result';
import { useToast } from '@/hooks/use-toast';
import { createInviteToken } from '@/lib/api-client';
import type { InviteTokenResponse } from '@/types';

interface InviteAdminDialogProps {
  open: boolean;
  onClose: () => void;
  canGrantManageAdmins: boolean;
}

export function InviteAdminDialog({ open, onClose, canGrantManageAdmins }: InviteAdminDialogProps) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteTokenResponse | null>(null);

  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [tomorrow] = useState(() =>
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  );
  const [oneMinuteAhead] = useState(() => new Date(Date.now() + 60000).toISOString().slice(0, 16));

  const [form, setForm] = useState({
    validDue: tomorrow,
    maxUsage: '1',
    manageAdmins: false,
    restrictedToFaculty: true,
  });

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    const result = await createInviteToken({
      validDue: new Date(form.validDue).toISOString(),
      maxUsage: parseInt(form.maxUsage, 10),
      manageAdmins: form.manageAdmins,
      restrictedToFaculty: form.restrictedToFaculty,
    });

    if (result.success) {
      setResult(result.data);
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const handleCopy = async () => {
    if (!result) return;

    await navigator.clipboard.writeText(result.token);
    setCopied(true);

    toast({
      title: 'Скопійовано!',
      variant: 'success',
      duration: 2000,
    });

    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = async () => {
    if (!result) return;

    const link = `${window.location.origin}/join/${result.token}`;
    await navigator.clipboard.writeText(link);

    setCopiedLink(true);

    toast({
      title: 'Посилання скопійовано!',
      variant: 'success',
      duration: 2000,
    });

    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
    setCopied(false);
    setCopiedLink(false);

    setForm({
      validDue: tomorrow,
      maxUsage: '1',
      manageAdmins: false,
      restrictedToFaculty: true,
    });

    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogPanel maxWidth="md">
        <DialogHeader>
          <DialogTitle>Запросити адміністратора</DialogTitle>
          <DialogCloseButton onClose={handleClose} />
        </DialogHeader>

        <DialogBody className="space-y-5">
          {error && (
            <Alert variant="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          {!result ? (
            <>
              <FormField label="Дійсний до" required htmlFor="validDue">
                <Input
                  id="validDue"
                  type="datetime-local"
                  value={form.validDue}
                  min={oneMinuteAhead}
                  onChange={(e) => setForm((p) => ({ ...p, validDue: e.target.value }))}
                />
              </FormField>

              <FormField label="Кількість використань" htmlFor="maxUsage" hint="Від 1 до 100">
                <Input
                  id="maxUsage"
                  type="number"
                  min={1}
                  max={100}
                  value={form.maxUsage}
                  onChange={(e) => setForm((p) => ({ ...p, maxUsage: e.target.value }))}
                />
              </FormField>

              <div className="space-y-3">
                <ToggleField
                  label="Обмежити підрозділом"
                  description="Новий адмін зможе керувати створювати опитування лише для свого підрозділу"
                  checked={form.restrictedToFaculty}
                  onChange={(v) => setForm((p) => ({ ...p, restrictedToFaculty: v }))}
                />

                {canGrantManageAdmins && (
                  <ToggleField
                    label="Керувати адмінами"
                    description="Дозволити запрошеному адміну запрошувати інших"
                    checked={form.manageAdmins}
                    onChange={(v) => setForm((p) => ({ ...p, manageAdmins: v }))}
                  />
                )}
              </div>
            </>
          ) : (
            <TokenResult
              token={result.token}
              copied={copied}
              copiedLink={copiedLink}
              onCopy={handleCopy}
              onCopyLink={handleCopyLink}
            />
          )}
        </DialogBody>

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="secondary" onClick={handleClose} disabled={loading}>
                Скасувати
              </Button>

              <Button variant="primary" onClick={handleSubmit} loading={loading}>
                Створити токен
              </Button>
            </>
          ) : (
            <Button variant="primary" fullWidth onClick={handleClose}>
              Готово
            </Button>
          )}
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
}
