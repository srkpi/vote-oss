'use client';

import { Check, ChevronDown, ChevronRight, Copy, Key, Plus, Trash2, UserX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
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
  BYPASS_TOKEN_MAX_DAYS,
  BYPASS_TOKEN_MAX_USAGE_MAX,
  BYPASS_TOKEN_MIN_HOURS,
} from '@/lib/constants';
import { pluralize } from '@/lib/utils';
import type { GlobalBypassToken } from '@/types/bypass';

interface BypassPageClientProps {
  initialTokens: GlobalBypassToken[];
  error: string | null;
}

function TokenResult({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const link =
    typeof window !== 'undefined' ? `${window.location.origin}/use/${token}` : `/use/${token}`;

  const copy = async (text: string, setFn: (v: boolean) => void) => {
    await navigator.clipboard.writeText(text);
    setFn(true);
    setTimeout(() => setFn(false), 2000);
  };

  return (
    <div className="space-y-4">
      <Alert variant="success" title="Токен створено">
        Скопіюйте посилання або сирий токен.
      </Alert>
      <div>
        <p className="font-body text-muted-foreground mb-1.5 text-xs font-semibold tracking-wider uppercase">
          Посилання
        </p>
        <div className="flex items-center gap-2">
          <div className="bg-surface flex-1 overflow-hidden rounded border p-2.5">
            <p className="font-mono text-xs break-all select-all">{link}</p>
          </div>
          <Button
            variant={copiedLink ? 'secondary' : 'outline'}
            size="icon"
            onClick={() => copy(link, setCopiedLink)}
          >
            {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div>
        <p className="font-body text-muted-foreground mb-1.5 text-xs font-semibold tracking-wider uppercase">
          Токен
        </p>
        <div className="flex items-center gap-2">
          <div className="bg-surface flex-1 overflow-hidden rounded border p-2.5">
            <p className="font-mono text-xs break-all select-all">{token}</p>
          </div>
          <Button
            variant={copied ? 'secondary' : 'outline'}
            size="icon"
            onClick={() => copy(token, setCopied)}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function BypassTokenCard({
  token,
  onDelete,
  onRevokeUsage,
}: {
  token: GlobalBypassToken;
  onDelete: () => void;
  onRevokeUsage: (userId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const activeUsages = token.usages.filter((u) => !u.revokedAt);
  const isDeleted = !!token.deletedAt;

  const bypasses = [];
  if (token.bypassNotStudying) {
    bypasses.push('Статус навчання');
  }
  if (token.bypassGraduate) {
    bypasses.push('Аспірант');
  }

  return (
    <div
      className={`border-border-color overflow-hidden rounded-xl border bg-white ${isDeleted ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-body text-sm">{bypasses.join(', ')}</p>
          <p className="font-body text-muted-foreground text-xs">
            Використань: {token.currentUsage} / {token.maxUsage}
          </p>
          <p className="font-body text-muted-foreground text-xs">
            Дійсний до: {new Date(token.validUntil).toLocaleString('uk-UA')}
          </p>
          <p className="font-body text-muted-foreground text-xs">Видав: {token.creator.fullName}</p>
          {isDeleted && (
            <p className="font-body text-error text-xs">
              Видалено: {new Date(token.deletedAt!).toLocaleString('uk-UA')}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-body text-muted-foreground hidden text-xs sm:inline">
            {pluralize(activeUsages.length, ['активний', 'активні', 'активних'])}
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setExpanded((v) => !v)}
            className="text-muted-foreground"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          {token.canDelete && !isDeleted && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onDelete}
              className="text-error hover:bg-error-bg"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-border-subtle border-t p-4 sm:p-5">
          {token.usages.length === 0 ? (
            <p className="font-body text-muted-foreground text-sm">Токен ще не використовувався</p>
          ) : (
            <div className="space-y-2">
              <p className="font-body text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Використання
              </p>
              {token.usages.map((usage) => (
                <div
                  key={usage.id}
                  className="border-border-subtle bg-surface flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="text-foreground font-mono text-xs">{usage.userId}</p>
                    <p className="font-body text-muted-foreground text-xs">
                      {new Date(usage.usedAt).toLocaleString('uk-UA')}
                    </p>
                    {usage.revokedAt && (
                      <p className="font-body text-error text-xs">
                        Відкликано: {new Date(usage.revokedAt).toLocaleString('uk-UA')}
                      </p>
                    )}
                  </div>
                  {!usage.revokedAt && token.canRevokeUsages && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => onRevokeUsage(usage.userId)}
                      className="text-error hover:bg-error-bg"
                      title="Відкликати доступ"
                    >
                      <UserX className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function BypassPageClient({ initialTokens, error }: BypassPageClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [tokens, setTokens] = useState<GlobalBypassToken[]>(initialTokens);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GlobalBypassToken | null>(null);
  const [deleting, setDeleting] = useState(false);

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const minDate = new Date(now.getTime() + BYPASS_TOKEN_MIN_HOURS * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
  const maxDate = new Date(now.getTime() + BYPASS_TOKEN_MAX_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  const [validUntil, setValidUntil] = useState(tomorrow);
  const [bypassNotStudying, setBypassNotStudying] = useState(false);
  const [bypassGraduate, setBypassGraduate] = useState(false);
  const [maxUsage, setMaxUsage] = useState(1);
  const canCreate = bypassNotStudying || bypassGraduate;

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    setCreateError(null);

    const result = await api.bypass.createGlobal({
      bypassNotStudying,
      bypassGraduate,
      maxUsage,
      validUntil: new Date(validUntil).toISOString(),
    });

    if (result.success) {
      setNewToken(result.data.token);

      // Immediately re-fetch the full list so the UI reflects the new token
      // once the dialog is dismissed — no manual page refresh needed.
      const listResult = await api.bypass.listGlobal();
      if (listResult.success) {
        setTokens(listResult.data);
      }

      router.refresh();
    } else {
      setCreateError(result.error);
    }
    setCreating(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    // Use the global-specific delete route
    const result = await api.bypass.deleteGlobal(deleteTarget.tokenHash);
    if (result.success) {
      // Soft delete: update local state to mark the token as deleted rather
      // than removing it, preserving the audit trail in the UI.
      setTokens((prev) =>
        prev.map((t) =>
          t.tokenHash === deleteTarget.tokenHash
            ? {
                ...t,
                usages: t.usages.map((u) => ({
                  ...u,
                  revokedAt: new Date().toISOString(),
                })),
                deletedAt: new Date().toISOString(),
                canDelete: false,
                canRevokeUsages: false,
              }
            : t,
        ),
      );
      toast({ title: 'Токен видалено', variant: 'success' });
      setDeleteTarget(null);
    } else {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
    }
    setDeleting(false);
  };

  const handleRevokeUsage = async (tokenHash: string, userId: string) => {
    // Use the global-specific revoke route
    const result = await api.bypass.revokeGlobalUsage(tokenHash, userId);
    if (result.success) {
      setTokens((prev) =>
        prev.map((t) =>
          t.tokenHash === tokenHash
            ? {
                ...t,
                usages: t.usages.map((u) =>
                  u.userId === userId ? { ...u, revokedAt: new Date().toISOString() } : u,
                ),
              }
            : t,
        ),
      );
      toast({ title: 'Доступ відкликано', variant: 'success' });
    } else {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
    }
  };

  const handleDialogClose = () => {
    setCreateOpen(false);
    setNewToken(null);
    setCreateError(null);
    setBypassNotStudying(false);
    setBypassGraduate(false);
    setMaxUsage(1);
    setValidUntil(tomorrow);
  };

  return (
    <div className="border-border-color shadow-shadow-card overflow-hidden rounded-xl border bg-white">
      <div className="border-border-subtle flex items-center justify-between border-b px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="navy-gradient flex h-8 w-8 items-center justify-center rounded-lg">
            <Key className="h-4 w-4 text-white" />
          </div>
          <h2 className="font-display text-foreground text-base font-semibold sm:text-lg">
            Глобальні токени доступу
          </h2>
        </div>
        <Button
          variant="accent"
          size="sm"
          onClick={() => setCreateOpen(true)}
          icon={<Plus className="h-3.5 w-3.5" />}
        >
          <span className="hidden sm:inline">Новий токен</span>
        </Button>
      </div>

      <div className="p-4 sm:p-6">
        {error && (
          <Alert variant="error" title="Помилка завантаження" className="mb-4">
            {error}
          </Alert>
        )}

        {tokens.length === 0 ? (
          <EmptyState
            icon={<Key className="h-8 w-8" />}
            title="Активних токенів доступу немає"
            description="Створіть токен для студента, що має проблему з входом у платформу"
          />
        ) : (
          <div className="space-y-3">
            {tokens.map((token) => (
              <BypassTokenCard
                key={token.tokenHash}
                token={token}
                onDelete={() => setDeleteTarget(token)}
                onRevokeUsage={(userId) => handleRevokeUsage(token.tokenHash, userId)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={handleDialogClose}>
        <DialogPanel maxWidth="md">
          <DialogHeader>
            <DialogTitle>Новий токен доступу</DialogTitle>
            <DialogCloseButton onClose={handleDialogClose} />
          </DialogHeader>
          <DialogBody className="space-y-5">
            {createError && (
              <Alert variant="error" onDismiss={() => setCreateError(null)}>
                {createError}
              </Alert>
            )}

            {!newToken ? (
              <>
                <ToggleField
                  label="Обхід статусу навчання"
                  description='Дозволяє студенту увійти навіть якщо статус навчання в кампусі "Відрахований"'
                  checked={bypassNotStudying}
                  onChange={setBypassNotStudying}
                />

                <ToggleField
                  label="Обхід перевірки рівня навчання"
                  description="Дозволяє аспіранту увійти на платформу"
                  checked={bypassGraduate}
                  onChange={setBypassGraduate}
                />

                {!canCreate && (
                  <p className="text-error font-body text-sm">Оберіть хоча б один варіант обходу</p>
                )}

                <FormField
                  label="Максимальна кількість використань"
                  required
                  htmlFor="bypass-max-usage"
                >
                  <Input
                    id="bypass-max-usage"
                    type="number"
                    min={1}
                    max={BYPASS_TOKEN_MAX_USAGE_MAX}
                    value={maxUsage}
                    onChange={(e) => setMaxUsage(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </FormField>

                <FormField label="Дійсний до" required htmlFor="bypass-valid-until">
                  <Input
                    id="bypass-valid-until"
                    type="datetime-local"
                    value={validUntil}
                    min={minDate}
                    max={maxDate}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
                </FormField>
              </>
            ) : (
              <TokenResult token={newToken} />
            )}
          </DialogBody>
          <DialogFooter>
            {!newToken ? (
              <>
                <Button variant="secondary" onClick={handleDialogClose} disabled={creating}>
                  Скасувати
                </Button>
                <Button
                  variant="accent"
                  onClick={handleCreate}
                  loading={creating}
                  disabled={!canCreate}
                >
                  Створити токен
                </Button>
              </>
            ) : (
              <Button variant="primary" fullWidth onClick={handleDialogClose}>
                Готово
              </Button>
            )}
          </DialogFooter>
        </DialogPanel>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Видалити токен доступу?</DialogTitle>
            <DialogCloseButton onClose={() => setDeleteTarget(null)} />
          </DialogHeader>
          <DialogBody>
            <Alert variant="warning">
              Токен буде деактивовано. Усі активні використання цього токена будуть відкликані.
              Історія використань залишиться для аудиту.
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
    </div>
  );
}
