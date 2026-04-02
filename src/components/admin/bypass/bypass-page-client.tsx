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
import { BYPASS_TOKEN_MAX_DAYS, BYPASS_TOKEN_MIN_HOURS } from '@/lib/constants';
import { pluralize } from '@/lib/utils';
import type { BypassToken } from '@/types/bypass';

interface BypassPageClientProps {
  initialTokens: BypassToken[];
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
  token: BypassToken;
  onDelete: () => void;
  onRevokeUsage: (userId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const activeUsages = token.usages.filter((u) => !u.revokedAt);

  return (
    <div className="border-border-color overflow-hidden rounded-xl border bg-white">
      <div className="flex items-start justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-body text-foreground text-sm font-semibold">
              {token.bypassNotStudying ? 'Обхід статусу навчання' : 'Токен доступу'}
            </span>
            {token.bypassNotStudying && (
              <span className="bg-warning-bg text-warning rounded-full px-2 py-0.5 text-[10px] font-semibold">
                Статус навчання
              </span>
            )}
          </div>
          <p className="font-body text-muted-foreground text-xs">
            Дійсний до: {new Date(token.validUntil).toLocaleString('uk-UA')}
          </p>
          <p className="font-body text-muted-foreground text-xs">Видав: {token.creator.fullName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-body text-muted-foreground text-xs">
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
          <Button
            variant="ghost"
            size="xs"
            onClick={onDelete}
            className="text-error hover:bg-error-bg"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
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
                      {usage.revokedAt && (
                        <span className="text-error ml-2">
                          Відкликано {new Date(usage.revokedAt).toLocaleString('uk-UA')}
                        </span>
                      )}
                    </p>
                  </div>
                  {!usage.revokedAt && (
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
  const [tokens, setTokens] = useState<BypassToken[]>(initialTokens);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BypassToken | null>(null);
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
  const [bypassNotStudying, setBypassNotStudying] = useState(true);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);

    const result = await api.bypass.createGlobal({
      bypassNotStudying,
      validUntil: new Date(validUntil).toISOString(),
    });

    if (result.success) {
      setNewToken(result.data.token);
      router.refresh();
    } else {
      setCreateError(result.error);
    }
    setCreating(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await api.bypass.delete(deleteTarget.tokenHash);
    if (result.success) {
      setTokens((prev) => prev.filter((t) => t.tokenHash !== deleteTarget.tokenHash));
      toast({ title: 'Токен видалено', variant: 'success' });
      setDeleteTarget(null);
    } else {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
    }
    setDeleting(false);
  };

  const handleRevokeUsage = async (tokenHash: string, userId: string) => {
    const result = await api.bypass.revokeUsage(tokenHash, userId);
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
    setBypassNotStudying(true);
    setValidUntil(tomorrow);
    router.refresh();
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
            description="Створіть токен для студента, що має проблему з доступом"
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
                <Alert variant="warning">
                  Токен буде видано для обходу обмежень платформи. Переконайтесь, що запит є
                  обґрунтованим перед створенням.
                </Alert>

                <ToggleField
                  label="Обхід статусу навчання"
                  description="Дозволяє студенту увійти навіть якщо статус навчання в кампусі відрахований"
                  checked={bypassNotStudying}
                  onChange={setBypassNotStudying}
                />

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
                <Button variant="accent" onClick={handleCreate} loading={creating}>
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
              Токен буде видалено. Усі користувачі, що використали цей токен, втратять надані права
              доступу.
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
