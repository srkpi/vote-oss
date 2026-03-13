'use client';

import { Key, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { InviteAdminDialog } from '@/components/admin/invite-admin-dialog';
import { TokensTable } from '@/components/admin/tokens-table';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
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

  const handleDelete = (tokenHash: string) => {
    setTokens((prev) => prev.filter((t) => t.token_hash !== tokenHash));
  };

  // When the create dialog closes (regardless of whether a token was created),
  // trigger a server re-render so the list reflects any new token.  The local
  // state is intentionally preserved for the delete-optimistic-update path;
  // new tokens are surfaced via the server component rehydration.
  const handleDialogClose = () => {
    setCreateOpen(false);
    router.refresh();
  };

  const ownCount = tokens.filter((t) => t.isOwn).length;
  const totalCount = tokens.length;

  return (
    <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg navy-gradient flex items-center justify-center">
            <Key className="w-4 h-4 text-white" />
          </div>
          <h2 className="font-display text-base sm:text-lg font-semibold text-[var(--foreground)]">
            Токени запрошення
          </h2>
        </div>

        <Button
          variant="accent"
          size="sm"
          onClick={() => setCreateOpen(true)}
          icon={<UserPlus className="w-3.5 h-3.5" />}
        >
          <span className="hidden sm:inline">Запросити адміна</span>
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 sm:p-6">
          <Alert variant="error" title="Помилка завантаження">
            {error}
          </Alert>
        </div>
      )}

      {!error && (
        <div className="p-4 sm:p-6 space-y-5">
          {/* Stats summary */}
          {totalCount > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm font-body text-[var(--muted-foreground)] px-1">
              <span>
                <strong className="text-[var(--foreground)]">{totalCount}</strong>{' '}
                {totalCount === 1
                  ? 'активний токен'
                  : totalCount < 5
                    ? 'активних токени'
                    : 'активних токенів'}
              </span>
              {ownCount > 0 && (
                <span>
                  <strong className="text-[var(--foreground)]">{ownCount}</strong> створено вами
                </span>
              )}
            </div>
          )}

          {totalCount === 0 ? (
            <EmptyState icon={<Key className="w-8 h-8" />} title="Активних токенів немає" />
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
