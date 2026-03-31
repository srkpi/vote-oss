'use client';

import { FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { ElectionMobileCard } from '@/components/elections/admin/election-mobile-card';
import { ElectionRow } from '@/components/elections/admin/election-row';
import { RestoreElectionButton } from '@/components/elections/admin/restore-election-button';
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
import { SearchInput } from '@/components/ui/search-input';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import { formatDateTime } from '@/lib/utils';
import type { Election, ElectionStatus } from '@/types/election';

interface AdminElectionsClientProps {
  elections: Election[];
  error: string | null;
}

type TabKey = 'all' | ElectionStatus | 'deleted';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'Усі' },
  { key: 'open', label: 'Активні' },
  { key: 'upcoming', label: 'Майбутні' },
  { key: 'closed', label: 'Завершені' },
  { key: 'deleted', label: 'Видалені' },
];

export function AdminElectionsClient({ elections, error }: AdminElectionsClientProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Election[]>(elections);
  const [deleteTarget, setDeleteTarget] = useState<Election | null>(null);
  const [deleting, setDeleting] = useState(false);

  const searchTrimmed = search.length > 100 ? search.substring(0, 100) + '...' : search;

  const counts: Record<TabKey, number> = useMemo(
    () => ({
      all: items.filter((e) => !e.deletedAt).length,
      open: items.filter((e) => e.status === 'open' && !e.deletedAt).length,
      upcoming: items.filter((e) => e.status === 'upcoming' && !e.deletedAt).length,
      closed: items.filter((e) => e.status === 'closed' && !e.deletedAt).length,
      deleted: items.filter((e) => !!e.deletedAt).length,
    }),
    [items],
  );

  const filtered = useMemo(() => {
    let result = items;

    if (activeTab === 'deleted') {
      result = result.filter((e) => !!e.deletedAt);
    } else if (activeTab === 'all') {
      result = result.filter((e) => !e.deletedAt);
    } else {
      result = result.filter((e) => e.status === activeTab && !e.deletedAt);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (e) => e.title.toLowerCase().includes(q) || e.creator.fullName.toLowerCase().includes(q),
      );
    }
    return result;
  }, [items, activeTab, search]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    const result = await api.elections.delete(deleteTarget.id);
    if (result.success) {
      toast({
        title: 'Голосування видалено',
        description: `«${deleteTarget.title}» було успішно видалено.`,
        variant: 'success',
      });
      // Soft delete: mark as deleted in local state instead of removing.
      setItems((prev) =>
        prev.map((e) =>
          e.id === deleteTarget.id
            ? { ...e, deletedAt: new Date().toISOString(), canDelete: false, canRestore: true }
            : e,
        ),
      );
      setDeleteTarget(null);
      router.refresh();
    } else {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
    }
    setDeleting(false);
  };

  if (error) {
    return (
      <div className="border-border-color shadow-shadow-card rounded-xl border bg-white">
        <ErrorState title="Помилка завантаження" description={error} />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Tabs
            tabs={TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabCount={(key) => counts[key]}
          />
          <SearchInput value={search} onChange={setSearch} placeholder="Пошук голосувань…" />

          {(search || activeTab !== 'all') && filtered.length > 0 && (
            <p className="font-body text-muted-foreground shrink-0 text-xs">
              {filtered.length} з {items.length}
            </p>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="border-border-color shadow-shadow-card rounded-xl border bg-white">
            <EmptyState
              icon={<FileText className="h-8 w-8" />}
              title={
                activeTab === 'deleted'
                  ? 'Немає видалених голосувань'
                  : search
                    ? 'Голосувань не знайдено'
                    : 'Голосувань немає'
              }
              description={search ? `За запитом «${searchTrimmed}» нічого не знайдено` : undefined}
            />
          </div>
        ) : activeTab === 'deleted' ? (
          /* ── Deleted elections list ─────────────────────────────────────── */
          <div className="border-border-color shadow-shadow-card overflow-hidden rounded-xl border bg-white">
            <div className="divide-border-subtle divide-y">
              {filtered.map((election) => (
                <div key={election.id} className="flex items-start gap-3 p-4 sm:p-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-foreground text-sm font-semibold wrap-break-word opacity-60">
                      {election.title}
                    </p>
                    <p className="font-body text-muted-foreground mt-0.5 text-xs">
                      Видалив(-ла){' '}
                      <span className="font-medium">{election.deletedBy?.fullName ?? '—'}</span>
                      {election.deletedAt ? ` · ${formatDateTime(election.deletedAt)}` : ''}
                    </p>
                  </div>
                  {election.canRestore && (
                    <RestoreElectionButton
                      electionId={election.id}
                      electionTitle={election.title}
                      variant="inline"
                      onRestored={() => {
                        setItems((prev) =>
                          prev.map((e) =>
                            e.id === election.id
                              ? {
                                  ...e,
                                  deletedAt: null,
                                  deletedBy: null,
                                  canDelete: true,
                                  canRestore: false,
                                }
                              : e,
                          ),
                        );
                        router.refresh();
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ── Active elections table / cards ─────────────────────────────── */
          <div className="border-border-color shadow-shadow-card overflow-hidden rounded-xl border bg-white">
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full">
                <thead>
                  <tr className="border-border-subtle border-b">
                    {['Назва', 'Статус', 'Початок', 'Завершення', 'Голоси', 'Доступ', ''].map(
                      (h) => (
                        <th
                          key={h}
                          className="font-body text-muted-foreground px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-border-subtle divide-y">
                  {filtered.map((election) => (
                    <ElectionRow
                      key={election.id}
                      election={election}
                      canDelete={election.canDelete ?? false}
                      onDelete={() => setDeleteTarget(election)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-border-subtle divide-y lg:hidden">
              {filtered.map((election) => (
                <ElectionMobileCard
                  key={election.id}
                  election={election}
                  canDelete={election.canDelete ?? false}
                  onDelete={() => setDeleteTarget(election)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Видалити голосування?</DialogTitle>
            <DialogCloseButton onClose={() => setDeleteTarget(null)} />
          </DialogHeader>
          <DialogBody>
            <Alert variant="warning">
              Голосування <strong className="wrap-break-word">«{deleteTarget?.title}»</strong> буде
              приховано від студентів. Ви зможете відновити його пізніше.
            </Alert>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Скасувати
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm} loading={deleting}>
              Видалити
            </Button>
          </DialogFooter>
        </DialogPanel>
      </Dialog>
    </>
  );
}
