'use client';

import { CheckCircle2, Megaphone, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
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
import { LocalDateTime } from '@/components/ui/local-time';
import { SearchInput } from '@/components/ui/search-input';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import { PETITION_QUORUM } from '@/lib/constants';
import type { Election } from '@/types/election';

type TabKey = 'pending' | 'approved' | 'all';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'pending', label: 'Очікують' },
  { key: 'approved', label: 'Затверджені' },
  { key: 'all', label: 'Всі' },
];

interface AdminPetitionsClientProps {
  initialPetitions: Election[];
}

export function AdminPetitionsClient({ initialPetitions }: AdminPetitionsClientProps) {
  const { toast } = useToast();
  const [petitions, setPetitions] = useState<Election[]>(initialPetitions);
  const [tab, setTab] = useState<TabKey>('pending');
  const [search, setSearch] = useState('');
  const [approving, setApproving] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Election | null>(null);
  const [deleting, setDeleting] = useState(false);

  const visible = useMemo(() => {
    let list = petitions.filter((p) => !p.deletedAt);
    if (tab === 'pending') list = list.filter((p) => !p.approved);
    if (tab === 'approved') list = list.filter((p) => p.approved);
    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (p) => p.title.toLowerCase().includes(q) || p.createdBy.fullName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [petitions, tab, search]);

  const handleApprove = async (id: string) => {
    setApproving(id);
    const res = await api.elections.approve(id);
    if (res.success) {
      setPetitions((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                approved: true,
                approvedAt: res.data.approvedAt,
                closesAt: res.data.closesAt,
              }
            : p,
        ),
      );
      toast({ title: 'Петицію затверджено', variant: 'success' });
    } else {
      toast({ title: 'Помилка', description: res.error, variant: 'error' });
    }
    setApproving(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await api.elections.delete(deleteTarget.id);
    if (res.success) {
      setPetitions((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      toast({ title: 'Петицію видалено', variant: 'success' });
      setDeleteTarget(null);
    } else {
      toast({ title: 'Помилка', description: res.error, variant: 'error' });
    }
    setDeleting(false);
  };

  const pendingCount = petitions.filter((p) => !p.approved && !p.deletedAt).length;

  return (
    <div className="border-border-color shadow-shadow-sm overflow-hidden rounded-xl border bg-white">
      <div className="border-border-subtle space-y-4 border-b p-4 sm:p-6">
        {pendingCount > 0 && (
          <Alert variant="info">
            Очікують на апрув: <strong>{pendingCount}</strong>
          </Alert>
        )}
        <Tabs tabs={TABS} activeTab={tab} onTabChange={setTab} />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Пошук за назвою або автором…"
        />
      </div>

      <div className="p-4 sm:p-6">
        {visible.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="h-10 w-10" />}
            title="Петицій не знайдено"
            description={search ? 'Спробуйте інший запит.' : 'Тут поки порожньо.'}
          />
        ) : (
          <div className="space-y-3">
            {visible.map((p) => {
              const pct = Math.min(100, Math.round((p.ballotCount / PETITION_QUORUM) * 100));
              return (
                <div
                  key={p.id}
                  className="border-border-subtle flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      {!p.approved ? (
                        <Badge variant="warning">Очікує</Badge>
                      ) : (
                        <Badge variant="success">Активна</Badge>
                      )}
                      <span className="font-body text-muted-foreground text-xs">
                        {p.ballotCount}/{PETITION_QUORUM} ({pct}%)
                      </span>
                    </div>
                    <Link
                      href={`/petitions/${p.id}`}
                      className="font-display text-foreground hover:text-kpi-navy block truncate text-sm font-semibold transition-colors"
                    >
                      {p.title}
                    </Link>
                    <p className="font-body text-muted-foreground mt-0.5 text-xs">
                      {p.createdBy.fullName} · <LocalDateTime date={p.createdAt} />
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!p.approved && (
                      <Button
                        variant="accent"
                        size="sm"
                        loading={approving === p.id}
                        onClick={() => handleApprove(p.id)}
                        icon={<CheckCircle2 className="h-4 w-4" />}
                      >
                        Затвердити
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleteTarget(p)}
                      icon={<Trash2 className="h-4 w-4" />}
                    >
                      Видалити
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Видалити петицію?</DialogTitle>
            <DialogCloseButton onClose={() => setDeleteTarget(null)} />
          </DialogHeader>
          <DialogBody>
            <Alert variant="warning">
              <strong>{deleteTarget?.title}</strong>. Цю дію неможливо скасувати.
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
