'use client';

import { Clock, Trash2, Users } from 'lucide-react';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { deleteInviteToken } from '@/lib/api-client';
import { cn, formatDateTime } from '@/lib/utils';
import type { InviteToken } from '@/types/admin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function usageFraction(token: InviteToken): number {
  if (token.max_usage === 0) return 0;
  return token.current_usage / token.max_usage;
}

function usageColor(fraction: number): string {
  if (fraction >= 1) return 'bg-[var(--error)]';
  if (fraction >= 0.8) return 'bg-[var(--kpi-orange)]';
  return 'bg-[var(--success)]';
}

function expiresLabel(validDue: string): { text: string; urgent: boolean } {
  const diff = new Date(validDue).getTime() - Date.now();
  const days = diff / (1000 * 60 * 60 * 24);

  return { text: formatDateTime(validDue), urgent: days < 3 };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface TokensTableProps {
  tokens: InviteToken[];
  onDelete: (tokenHash: string) => void;
}

export function TokensTable({ tokens, onDelete }: TokensTableProps) {
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<InviteToken | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    const result = await deleteInviteToken(deleteTarget.token_hash);
    if (result.success) {
      toast({
        title: 'Токен видалено',
        description: 'Посилання запрошення більше не діє.',
        variant: 'success',
      });
      onDelete(deleteTarget.token_hash);
      setDeleteTarget(null);
    } else {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
    }
    setDeleting(false);
  };

  if (tokens.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--muted-foreground)] font-body text-sm">
        Активних токенів запрошення немає
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              {['Видавець', 'Права', 'Використання', 'Дійсний до', ''].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider font-body"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {tokens.map((token) => (
              <TokenRow
                key={token.token_hash}
                token={token}
                onDelete={() => setDeleteTarget(token)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {tokens.map((token) => (
          <TokenCard key={token.token_hash} token={token} onDelete={() => setDeleteTarget(token)} />
        ))}
      </div>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Видалити токен?</DialogTitle>
            <DialogCloseButton onClose={() => setDeleteTarget(null)} />
          </DialogHeader>
          <DialogBody>
            <Alert variant="warning">
              Токен буде видалено. Посилання запрошення, що використовує цей токен, стане недійсним.
            </Alert>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Скасувати
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm} loading={deleting}>
              Видалити токен
            </Button>
          </DialogFooter>
        </DialogPanel>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Desktop row
// ---------------------------------------------------------------------------

interface TokenRowProps {
  token: InviteToken;
  onDelete: () => void;
}

function TokenRow({ token, onDelete }: TokenRowProps) {
  const fraction = usageFraction(token);
  const { text: expiresText, urgent } = expiresLabel(token.valid_due);

  return (
    <tr
      className={cn(
        'transition-colors duration-150',
        token.isOwn
          ? 'bg-[var(--kpi-blue-light)]/5 hover:bg-[var(--kpi-blue-light)]/10'
          : 'hover:bg-[var(--surface)]',
      )}
    >
      {/* Creator */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full navy-gradient flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {token.creator.full_name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-body text-[var(--foreground)]">{token.creator.full_name}</p>
            <p className="text-xs font-body text-[var(--muted-foreground)]">
              {token.creator.user_id}
            </p>
          </div>
        </div>
      </td>

      {/* Permissions */}
      <td className="px-4 py-3.5">
        <div className="flex flex-wrap gap-1.5">
          {token.manage_admins && (
            <Badge variant="info" size="sm">
              Керування адмінами
            </Badge>
          )}
          {token.restricted_to_faculty && (
            <Badge variant="warning" size="sm">
              Обмежений до підрозділу
            </Badge>
          )}
          {!token.manage_admins && !token.restricted_to_faculty && (
            <Badge variant="default" size="sm">
              Базові
            </Badge>
          )}
        </div>
      </td>

      {/* Usage */}
      <td className="px-4 py-3.5">
        <div className="space-y-1.5 w-24">
          <p className="text-sm font-body text-[var(--foreground)]">
            <span className="font-semibold">{token.current_usage}</span>
            <span className="text-[var(--muted-foreground)]"> / {token.max_usage}</span>
          </p>
          <div className="h-1.5 w-full rounded-full bg-[var(--border-color)] overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', usageColor(fraction))}
              style={{ width: `${Math.min(fraction * 100, 100)}%` }}
            />
          </div>
        </div>
      </td>

      {/* Expires */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          {urgent && <Clock className="w-3.5 h-3.5 text-[var(--kpi-orange)] shrink-0" />}
          <span
            className={cn(
              'text-sm font-body',
              urgent ? 'text-[var(--kpi-orange)] font-medium' : 'text-[var(--foreground)]',
            )}
          >
            {expiresText}
          </span>
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3.5 text-right">
        {token.deletable && (
          <Button
            variant="ghost"
            size="md"
            onClick={onDelete}
            className="text-[var(--error)] hover:bg-[var(--error-bg)]"
            title="Видалити токен"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Mobile card
// ---------------------------------------------------------------------------

function TokenCard({ token, onDelete }: TokenRowProps) {
  const fraction = usageFraction(token);
  const { text: expiresText, urgent } = expiresLabel(token.valid_due);

  return (
    <div
      className={cn(
        'p-4 rounded-[var(--radius-lg)] border border-[var(--border-color)]',
        'bg-white shadow-[var(--shadow-sm)]',
        token.isOwn && 'border-[var(--kpi-navy)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full navy-gradient flex items-center justify-center text-white font-semibold shrink-0">
            {token.creator.full_name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-[var(--foreground)] font-body">
                {token.creator.full_name}
              </p>
            </div>
          </div>
        </div>
        {token.deletable && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onDelete}
            className="text-[var(--error)] hover:bg-[var(--error-bg)]"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Permissions & usage row */}
      <div className="flex items-center justify-between gap-3 mt-3">
        <div className="flex flex-wrap gap-1">
          {token.manage_admins && (
            <Badge variant="info" size="sm">
              Керування адмінами
            </Badge>
          )}
          {token.restricted_to_faculty && (
            <Badge variant="warning" size="sm">
              Обмежений підрозділом
            </Badge>
          )}
          {!token.manage_admins && !token.restricted_to_faculty && (
            <Badge variant="default" size="sm">
              Базові
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Users className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
          <span className="text-xs font-body text-[var(--foreground)]">
            <span className="font-semibold">{token.current_usage}</span>
            <span className="text-[var(--muted-foreground)]"> / {token.max_usage}</span>
          </span>
        </div>
      </div>

      {/* Usage bar */}
      <div className="h-1.5 w-full rounded-full bg-[var(--border-color)] overflow-hidden mt-3">
        <div
          className={cn('h-full rounded-full transition-all', usageColor(fraction))}
          style={{ width: `${Math.min(fraction * 100, 100)}%` }}
        />
      </div>

      {/* Expiry */}
      <div className="flex items-center gap-1.5 mt-3">
        <Clock
          className={cn(
            'w-3.5 h-3.5 shrink-0',
            urgent ? 'text-[var(--kpi-orange)]' : 'text-[var(--muted-foreground)]',
          )}
        />
        <span
          className={cn(
            'text-xs font-body',
            urgent ? 'text-[var(--kpi-orange)] font-medium' : 'text-[var(--muted-foreground)]',
          )}
        >
          Дійсний до: {expiresText}
        </span>
      </div>
    </div>
  );
}
