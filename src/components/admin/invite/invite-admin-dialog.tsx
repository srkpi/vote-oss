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
import { KyivDateTimePicker } from '@/components/ui/kyiv-date-time-picker';
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
  canGrantManageGroups: boolean;
  canGrantManagePetitions: boolean;
  canGrantManageFaq: boolean;
  restrictedToFaculty: boolean;
}

export function InviteAdminDialog({
  open,
  onClose,
  canGrantManageAdmins,
  canGrantManageGroups,
  canGrantManagePetitions,
  canGrantManageFaq,
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
    maxUsage: String(INVITE_TOKEN_MAX_USAGE_MIN),
    manageAdmins: false,
    manageGroups: false,
    managePetitions: false,
    manageFaq: false,
    restrictedToFaculty: true,
  });

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    const res = await api.admins.invites.create({
      validDue: new Date(form.validDue).toISOString(),
      maxUsage: parseInt(form.maxUsage, 10),
      manageAdmins: form.manageAdmins,
      manageGroups: form.manageGroups,
      managePetitions: form.managePetitions,
      manageFaq: form.manageFaq,
      restrictedToFaculty: form.restrictedToFaculty,
    });

    if (res.success) {
      setResult(res.data);
    } else {
      setError(res.error);
    }

    setLoading(false);
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.token);
    setCopied(true);
    toast({ title: 'Скопійовано!', variant: 'success', duration: 2000 });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = async () => {
    if (!result) return;
    const link = `${window.location.origin}/join/${result.token}`;
    await navigator.clipboard.writeText(link);
    setCopiedLink(true);
    toast({ title: 'Посилання скопійовано!', variant: 'success', duration: 2000 });
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
      manageGroups: false,
      managePetitions: false,
      manageFaq: false,
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
                <KyivDateTimePicker
                  id="validDue"
                  value={form.validDue}
                  min={oneMinuteAhead}
                  max={maxValidDate}
                  onChange={(date) => setForm((p) => ({ ...p, validDue: date.toISOString() }))}
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
                  label="Керувати адмінами"
                  description="Дозволити запрошеному адміну запрошувати інших"
                  checked={form.manageAdmins}
                  onChange={(v) => setForm((p) => ({ ...p, manageAdmins: v }))}
                  disabled={!canGrantManageAdmins}
                />

                <ToggleField
                  label="Керувати групами"
                  description={
                    !canGrantManageGroups
                      ? 'Ви не маєте цього права, тому не можете його передати'
                      : 'Дозволити переглядати та модерувати групи в системі'
                  }
                  checked={form.manageGroups}
                  onChange={(v) => setForm((p) => ({ ...p, manageGroups: v }))}
                  disabled={!canGrantManageGroups}
                />

                <ToggleField
                  label="Керувати петиціями"
                  description={
                    !canGrantManagePetitions
                      ? 'Ви не маєте цього права, тому не можете його передати'
                      : 'Дозволити апрувати петиції користувачів та видаляти їх'
                  }
                  checked={form.managePetitions}
                  onChange={(v) => setForm((p) => ({ ...p, managePetitions: v }))}
                  disabled={!canGrantManagePetitions}
                />

                <ToggleField
                  label="Редагування FAQ"
                  description={
                    !canGrantManageFaq
                      ? 'Ви не маєте цього права, тому не можете його передати'
                      : 'Дозволити редагувати FAQ'
                  }
                  checked={form.manageFaq}
                  onChange={(v) => setForm((p) => ({ ...p, manageFaq: v }))}
                  disabled={!canGrantManageFaq}
                />

                <ToggleField
                  label="Обмежити підрозділом"
                  description="Новий адмін зможе керувати опитуваннями лише свого підрозділу"
                  checked={form.restrictedToFaculty}
                  onChange={(v) => setForm((p) => ({ ...p, restrictedToFaculty: v }))}
                  disabled={restrictedToFaculty}
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
