'use client';

import { useState } from 'react';

import { TokenMobileCard } from '@/components/admin/token-mobile-card';
import { TokenRow } from '@/components/admin/token-row';
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
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import type { InviteToken } from '@/types/admin';

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

    const result = await api.deleteInviteToken(deleteTarget.tokenHash);
    if (result.success) {
      toast({
        title: 'Токен видалено',
        description: 'Посилання запрошення більше не діє.',
        variant: 'success',
      });
      onDelete(deleteTarget.tokenHash);
      setDeleteTarget(null);
    } else {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
    }
    setDeleting(false);
  };

  if (tokens.length === 0) {
    return (
      <div className="font-body text-muted-foreground py-12 text-center text-sm">
        Активних токенів запрошення немає
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead>
            <tr className="border-border-subtle border-b">
              {['Видавець', 'Права', 'Використання', 'Дійсний до', ''].map((h) => (
                <th
                  key={h}
                  className="font-body text-muted-foreground px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border-subtle divide-y">
            {tokens.map((token) => (
              <TokenRow
                key={token.tokenHash}
                token={token}
                onDelete={() => setDeleteTarget(token)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {tokens.map((token) => (
          <TokenMobileCard
            key={token.tokenHash}
            token={token}
            onDelete={() => setDeleteTarget(token)}
          />
        ))}
      </div>

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
