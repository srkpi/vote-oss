'use client';

import { FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { ElectionMobileCard } from '@/components/admin/election-mobile-card';
import { ElectionRow } from '@/components/admin/election-row';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
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
import type { User } from '@/types/auth';
import type { Election, ElectionStatus } from '@/types/election';

interface AdminElectionsClientProps {
  elections: Election[];
  error: string | null;
  session: User;
}

type TabKey = 'all' | ElectionStatus;

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'Усі' },
  { key: 'open', label: 'Активні' },
  { key: 'upcoming', label: 'Майбутні' },
  { key: 'closed', label: 'Завершені' },
];

function canAdminDeleteElection(user: User, election: Election): boolean {
  if (!user.isAdmin) return false;
  if (!user.restrictedToFaculty) return true;
  return election.restrictedToFaculty === user.faculty;
}

export function AdminElectionsClient({ elections, error, session }: AdminElectionsClientProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Election[]>(elections);
  const [deleteTarget, setDeleteTarget] = useState<Election | null>(null);
  const [deleting, setDeleting] = useState(false);

  const counts: Record<TabKey, number> = useMemo(
    () => ({
      all: items.length,
      open: items.filter((e) => e.status === 'open').length,
      upcoming: items.filter((e) => e.status === 'upcoming').length,
      closed: items.filter((e) => e.status === 'closed').length,
    }),
    [items],
  );

  const filtered = useMemo(() => {
    let result = items;
    if (activeTab !== 'all') {
      result = result.filter((e) => e.status === activeTab);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.creator.full_name.toLowerCase().includes(q) ||
          (e.restrictedToFaculty?.toLowerCase().includes(q) ?? false) ||
          (e.restrictedToGroup?.toLowerCase().includes(q) ?? false),
      );
    }
    return result;
  }, [items, activeTab, search]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    const result = await api.deleteElection(deleteTarget.id);
    if (result.success) {
      toast({
        title: 'Голосування видалено',
        description: `«${deleteTarget.title}» було успішно видалено.`,
        variant: 'success',
      });
      setItems((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      setDeleteTarget(null);
      router.refresh();
    } else {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
    }
    setDeleting(false);
  };

  if (error) {
    return (
      <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)]">
        <ErrorState title="Помилка завантаження" description={error} />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Tabs
            tabs={TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabCount={(key) => counts[key]}
          />
          <SearchInput value={search} onChange={setSearch} placeholder="Пошук голосувань…" />

          {(search || activeTab !== 'all') && filtered.length > 0 && (
            <p className="text-xs text-[var(--muted-foreground)] font-body shrink-0">
              {filtered.length} з {items.length}
            </p>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)]">
            <EmptyState
              icon={<FileText className="w-8 h-8" />}
              title={search ? 'Голосувань не знайдено' : 'Голосувань немає'}
              description={search ? `За запитом «${search}» нічого не знайдено` : undefined}
            />
          </div>
        ) : (
          <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden">
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)]">
                    {['Назва', 'Статус', 'Початок', 'Завершення', 'Голоси', 'Доступ', ''].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider font-body"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {filtered.map((election) => (
                    <ElectionRow
                      key={election.id}
                      election={election}
                      canDelete={canAdminDeleteElection(session, election)}
                      onDelete={() => setDeleteTarget(election)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden divide-y divide-[var(--border-subtle)]">
              {filtered.map((election) => (
                <ElectionMobileCard
                  key={election.id}
                  election={election}
                  canDelete={canAdminDeleteElection(session, election)}
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
              Голосування <strong className="break-words">«{deleteTarget?.title}»</strong> та всі
              пов&apos;язані бюлетені будуть видалені. Цю дію неможливо скасувати.
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
