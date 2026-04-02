'use client';

import { Check, ChevronDown, ChevronRight, Copy, Key, Plus, Trash2, UserX } from 'lucide-react';
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
import { FormField, Input } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import {
  BYPASS_TOKEN_MAX_DAYS,
  BYPASS_TOKEN_MIN_HOURS,
  RESTRICTION_TYPE_LABELS,
} from '@/lib/constants';
import { pluralize } from '@/lib/utils';
import type { BypassToken } from '@/types/bypass';
import type { ElectionRestriction } from '@/types/election';

interface ElectionBypassPanelProps {
  electionId: string;
  initialTokens: BypassToken[];
  restrictions: ElectionRestriction[];
}

const BYPASSABLE_TYPES = ['FACULTY', 'GROUP', 'STUDY_YEAR', 'STUDY_FORM', 'LEVEL_COURSE'] as const;

function TokenResult({ token }: { token: string }) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copied, setCopied] = useState(false);
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
        Поділіться посиланням зі студентом.
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

function BypassTokenItem({
  token,
  onDelete,
  onRevokeUsage,
}: {
  token: BypassToken;
  onDelete: () => void;
  onRevokeUsage: (userId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const activeUsagesCount = token.usages.filter((u) => !u.revokedAt).length;

  const bypassLabel =
    token.bypassRestrictions.length === 0
      ? 'Всі обмеження'
      : token.bypassRestrictions.map((t) => RESTRICTION_TYPE_LABELS[t] ?? t).join(', ');

  return (
    <div className="border-border-color overflow-hidden rounded-lg border bg-white">
      <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
        <div className="min-w-0 flex-1">
          <p className="font-body text-foreground text-sm font-medium">Обходить: {bypassLabel}</p>
          <p className="font-body text-muted-foreground text-xs">
            До {new Date(token.validUntil).toLocaleString('uk-UA')} · {token.creator.fullName}
            {token.usages.filter((u) => !u.revokedAt).length > 0 && (
              <span className="text-success ml-2">
                {pluralize(activeUsagesCount, ['активний', 'активні', 'активних'])}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {token.usages.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setExpanded((v) => !v)}
              className="text-muted-foreground"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
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

      {expanded && token.usages.length > 0 && (
        <div className="border-border-subtle bg-surface border-t px-3 py-3 sm:px-4">
          <div className="space-y-2">
            {token.usages.map((usage) => (
              <div key={usage.id} className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-foreground font-mono text-xs">{usage.userId}</p>
                  <p className="font-body text-muted-foreground text-xs">
                    {new Date(usage.usedAt).toLocaleString('uk-UA')}
                    {usage.revokedAt && (
                      <span className="text-error ml-1">
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
                  >
                    <UserX className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ElectionBypassPanel({
  electionId,
  initialTokens,
  restrictions,
}: ElectionBypassPanelProps) {
  const { toast } = useToast();
  const [tokens, setTokens] = useState<BypassToken[]>(initialTokens);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BypassToken | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const minDate = new Date(now.getTime() + BYPASS_TOKEN_MIN_HOURS * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
  const maxDate = new Date(now.getTime() + BYPASS_TOKEN_MAX_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
  const [validUntil, setValidUntil] = useState(tomorrow);
  const [bypassRestrictions, setBypassRestrictions] = useState<string[]>([]);

  // Only show restriction types that actually exist on this election
  const presentTypes = [...new Set(restrictions.map((r) => r.type))].filter((t) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    BYPASSABLE_TYPES.includes(t as any),
  );

  const toggleRestriction = (type: string) =>
    setBypassRestrictions((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);

    const result = await api.elections.bypass.create(electionId, {
      bypassRestrictions,
      validUntil: new Date(validUntil).toISOString(),
    });

    if (result.success) {
      setNewToken(result.data.token);
      // Reload tokens
      const listResult = await api.elections.bypass.list(electionId);
      if (listResult.success) setTokens(listResult.data);
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
    setOpen(false);
    setNewToken(null);
    setCreateError(null);
    setBypassRestrictions([]);
    setValidUntil(tomorrow);
  };

  return (
    <div className="border-border-color shadow-shadow-card overflow-hidden rounded-xl border bg-white">
      <div className="border-border-subtle flex items-center justify-between border-b px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2">
          <Key className="text-kpi-gray-mid h-4 w-4" />
          <h3 className="font-display text-foreground text-base font-semibold">Токени доступу</h3>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Видати</span>
        </Button>
      </div>

      <div className="p-4 sm:p-5">
        {tokens.length === 0 ? (
          <p className="font-body text-muted-foreground text-sm">
            Немає активних токенів для цього голосування
          </p>
        ) : (
          <div className="space-y-2">
            {tokens.map((token) => (
              <BypassTokenItem
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
      <Dialog open={open} onClose={handleDialogClose}>
        <DialogPanel maxWidth="md">
          <DialogHeader>
            <DialogTitle>Видати токен доступу для голосування</DialogTitle>
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
                <Alert variant="info">
                  Токен дозволяє студенту проголосувати навіть якщо він не відповідає обмеженням
                  голосування (наприклад, дані кампусу застарілі).
                </Alert>

                {presentTypes.length > 0 && (
                  <div>
                    <p className="font-body text-foreground mb-2 text-sm font-medium">
                      Обійти обмеження:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {presentTypes.map((type) => {
                        const isSelected = bypassRestrictions.includes(type);
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => toggleRestriction(type)}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                              isSelected
                                ? 'border-kpi-navy bg-kpi-navy text-white'
                                : 'border-border-color text-foreground hover:border-kpi-blue-light'
                            }`}
                          >
                            {RESTRICTION_TYPE_LABELS[type] ?? type}
                          </button>
                        );
                      })}
                    </div>
                    {bypassRestrictions.length === 0 && (
                      <p className="text-error font-body mt-1.5 text-xs">
                        Оберіть хоча б один тип обмеження для обходу
                      </p>
                    )}
                  </div>
                )}

                <FormField label="Дійсний до" required htmlFor="election-bypass-valid-until">
                  <Input
                    id="election-bypass-valid-until"
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
                  disabled={!bypassRestrictions.length}
                >
                  Видати токен
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

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Видалити токен доступу?</DialogTitle>
            <DialogCloseButton onClose={() => setDeleteTarget(null)} />
          </DialogHeader>
          <DialogBody>
            <Alert variant="warning">
              Токен та всі пов&apos;язані з ним права доступу будуть анульовані.
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
