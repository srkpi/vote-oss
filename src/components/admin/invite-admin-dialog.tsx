'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form';
import {
  Dialog,
  DialogPanel,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogCloseButton,
} from '@/components/ui/dialog';
import { Alert } from '@/components/ui/alert';
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

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

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
    toast({ title: 'Скопійовано!', variant: 'success', duration: 2000 });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
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
          <div>
            <DialogTitle>Запросити адміністратора</DialogTitle>
            <DialogDescription>
              Створіть токен для запрошення нового адміністратора
            </DialogDescription>
          </div>
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
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Дійсний до" required htmlFor="validDue">
                  <Input
                    id="validDue"
                    type="datetime-local"
                    value={form.validDue}
                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
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
              </div>

              <div className="space-y-3">
                <ToggleField
                  label="Обмежити факультетом"
                  description="Новий адмін зможе керувати лише своїм факультетом"
                  checked={form.restrictedToFaculty}
                  onChange={(v) => setForm((p) => ({ ...p, restrictedToFaculty: v }))}
                />

                {canGrantManageAdmins && (
                  <ToggleField
                    label="Право керувати адмінами"
                    description="Дозволити запрошеному адміну запрошувати інших"
                    checked={form.manageAdmins}
                    onChange={(v) => setForm((p) => ({ ...p, manageAdmins: v }))}
                  />
                )}
              </div>
            </>
          ) : (
            <TokenResult token={result.token} copied={copied} onCopy={handleCopy} info={result} />
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

interface ToggleFieldProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function ToggleField({ label, description, checked, onChange }: ToggleFieldProps) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={cn(
            'w-10 h-6 rounded-full transition-all duration-200',
            checked ? 'bg-[var(--kpi-navy)]' : 'bg-[var(--border-color)]',
          )}
        >
          <div
            className={cn(
              'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200',
              checked ? 'left-5' : 'left-1',
            )}
          />
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-[var(--foreground)] font-body">{label}</p>
        {description && (
          <p className="text-xs text-[var(--muted-foreground)] font-body mt-0.5">{description}</p>
        )}
      </div>
    </label>
  );
}

interface TokenResultProps {
  token: string;
  copied: boolean;
  onCopy: () => void;
  info: InviteTokenResponse;
}

function TokenResult({ token, copied, onCopy }: TokenResultProps) {
  return (
    <div className="space-y-4 animate-scale-in">
      <Alert variant="success" title="Токен успішно створено">
        Скопіюйте токен та передайте його потрібній людині. Він буде показаний лише один раз.
      </Alert>

      <div>
        <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2 font-body">
          Токен запрошення
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 p-3 rounded-[var(--radius)] bg-[var(--surface)] border border-[var(--border-color)] overflow-hidden">
            <p className="font-mono text-xs text-[var(--foreground)] break-all select-all">
              {token}
            </p>
          </div>
          <Button
            variant={copied ? 'secondary' : 'outline'}
            size="sm"
            onClick={onCopy}
            icon={
              copied ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              )
            }
          >
            {copied ? 'Скопійовано' : 'Копіювати'}
          </Button>
        </div>
      </div>
    </div>
  );
}
