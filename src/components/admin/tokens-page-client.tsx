'use client';

import { Key, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { InviteAdminDialog } from '@/components/admin/invite-admin-dialog';
import { TokensTable } from '@/components/admin/tokens-table';
import { EmptyState } from '@/components/common/empty-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { InviteToken } from '@/types/admin';

interface TokensPageClientProps {
  initialTokens: InviteToken[];
  canGrantManageAdmins: boolean;
  restrictedToFaculty: boolean;
  error: string | null;
}

export function TokensPageClient({
  initialTokens,
  canGrantManageAdmins,
  restrictedToFaculty,
  error,
}: TokensPageClientProps) {
  const router = useRouter();
  const [tokens, setTokens] = useState<InviteToken[]>(initialTokens);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    setTokens(initialTokens);
  }, [initialTokens]);

  const handleDelete = (tokenHash: string) => {
    setTokens((prev) => prev.filter((t) => t.token_hash !== tokenHash));
  };

  // When the create dialog closes (regardless of whether a token was created),
  // trigger a server re-render so the list reflects any new token. The local
  // state is intentionally preserved for the delete-optimistic-update path;
  // new tokens are surfaced via the server component rehydration.
  const handleDialogClose = () => {
    setCreateOpen(false);
    router.refresh();
  };

  const ownCount = tokens.filter((t) => t.isOwn).length;
  const totalCount = tokens.length;

  return (
    <div className="overflow-hidden rounded-xl border border-(--border-color) bg-white shadow-(--shadow-card)">
      <div className="flex items-center justify-between border-b border-(--border-subtle) px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="navy-gradient flex h-8 w-8 items-center justify-center rounded-lg">
            <Key className="h-4 w-4 text-white" />
          </div>
          <h2 className="font-display text-base font-semibold text-(--foreground) sm:text-lg">
            Токени запрошення
          </h2>
        </div>

        <Button
          variant="accent"
          size="sm"
          onClick={() => setCreateOpen(true)}
          icon={<UserPlus className="h-3.5 w-3.5" />}
        >
          <span className="hidden sm:inline">Запросити адміна</span>
        </Button>
      </div>

      {error && (
        <div className="p-4 sm:p-6">
          <Alert variant="error" title="Помилка завантаження">
            {error}
          </Alert>
        </div>
      )}

      {!error && (
        <div className="space-y-5 p-4 sm:p-6">
          {totalCount > 0 && (
            <div className="font-body flex flex-col gap-2 px-1 text-sm text-(--muted-foreground) sm:flex-row sm:items-center sm:gap-4">
              <span>
                <strong className="text-(--foreground)">{totalCount}</strong>{' '}
                {totalCount === 1
                  ? 'активний токен'
                  : totalCount < 5
                    ? 'активних токени'
                    : 'активних токенів'}
              </span>
              {ownCount > 0 && (
                <span>
                  <strong className="text-(--foreground)">{ownCount}</strong> створено вами
                </span>
              )}
            </div>
          )}

          {totalCount === 0 ? (
            <EmptyState icon={<Key className="h-8 w-8" />} title="Активних токенів немає" />
          ) : (
            <TokensTable tokens={tokens} onDelete={handleDelete} />
          )}
        </div>
      )}

      <InviteAdminDialog
        open={createOpen}
        onClose={handleDialogClose}
        canGrantManageAdmins={canGrantManageAdmins}
        restrictedToFaculty={restrictedToFaculty}
      />
    </div>
  );
}
