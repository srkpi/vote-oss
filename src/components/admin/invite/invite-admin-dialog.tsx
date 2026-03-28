'use client';

import { useState } from 'react';

import { TokenResult } from '@/components/admin/invite/token-result';
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
import { FormField, Input } from '@/components/ui/form';
import { ToggleField } from '@/components/ui/toggle-field';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import {
  INVITE_TOKEN_MAX_USAGE_MAX,
  INVITE_TOKEN_MAX_USAGE_MIN,
  INVITE_TOKEN_MAX_VALID_DAYS,
} from '@/lib/constants';
import type { InviteTokenResponse } from '@/types/admin';

interface InviteAdminDialogProps {
  open: boolean;
  onClose: () => void;
  canGrantManageAdmins: boolean;
  restrictedToFaculty: boolean;
}

export function InviteAdminDialog({
  open,
  onClose,
  canGrantManageAdmins,
  restrictedToFaculty,
}: InviteAdminDialogProps) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteTokenResponse | null>(null);

  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [renderTime] = useState(() => Date.now());
  const tomorrow = new Date(renderTime + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const oneMinuteAhead = new Date(renderTime + 60000).toISOString().slice(0, 16);
  const maxValidDate = new Date(renderTime + INVITE_TOKEN_MAX_VALID_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  const [form, setForm] = useState({
    validDue: tomorrow,
    maxUsage: '1',
    manageAdmins: false,
    restrictedToFaculty: true,
  });

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    const result = await api.admins.invites.create({
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
      maxUsage: String(INVITE_TOKEN_MAX_USAGE_MIN),
      manageAdmins: false,
      restrictedToFaculty: restrictedToFaculty,
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
                  max={maxValidDate}
                  onChange={(e) => setForm((p) => ({ ...p, validDue: e.target.value }))}
                />
              </FormField>

              <FormField
                label="Кількість використань"
                htmlFor="maxUsage"
                hint={`Від ${INVITE_TOKEN_MAX_USAGE_MIN} до ${INVITE_TOKEN_MAX_USAGE_MAX}`}
              >
                <Input
                  id="maxUsage"
                  type="number"
                  min={INVITE_TOKEN_MAX_USAGE_MIN}
                  max={INVITE_TOKEN_MAX_USAGE_MAX}
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
                  disabled={restrictedToFaculty}
                />

                <ToggleField
                  label="Керувати адмінами"
                  description="Дозволити запрошеному адміну запрошувати інших"
                  checked={form.manageAdmins}
                  onChange={(v) => setForm((p) => ({ ...p, manageAdmins: v }))}
                  disabled={!canGrantManageAdmins}
                />
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

              <Button variant="accent" onClick={handleSubmit} loading={loading}>
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
