'use client';

import { Calendar, CheckCircle2, FileText, Megaphone, RotateCcw, Trash2 } from 'lucide-react';
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

type TabKey = 'pending' | 'approved' | 'all' | 'deleted';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'pending', label: 'Очікують' },
  { key: 'approved', label: 'Затверджені' },
  { key: 'all', label: 'Всі' },
  { key: 'deleted', label: 'Видалені' },
];

interface AdminPetitionsClientProps {
  initialPetitions: Election[];
}

function petitionQuorum(p: Election): number {
  return p.winningConditions.quorum ?? PETITION_QUORUM;
}

function PetitionStatusBadge({
  petition,
  size = 'md',
}: {
  petition: Election;
  size?: 'sm' | 'md';
}) {
  if (petition.deletedAt) {
    return (
      <Badge variant="secondary" size={size}>
        Видалене
      </Badge>
    );
  }
  if (!petition.approved) {
    return (
      <Badge variant="warning" size={size}>
        Очікує
      </Badge>
    );
  }
  if (petition.status === 'closed') {
    return petition.ballotCount >= petitionQuorum(petition) ? (
      <Badge variant="info" size={size}>
        Кворум
      </Badge>
    ) : (
      <Badge variant="secondary" size={size}>
        Закрите
      </Badge>
    );
  }
  return (
    <Badge variant="success" size={size}>
      Активне
    </Badge>
  );
}

function ProgressCell({ petition, dim }: { petition: Election; dim?: boolean }) {
  const quorum = petitionQuorum(petition);
  const pct = Math.min(100, Math.round((petition.ballotCount / quorum) * 100));
  const reached = petition.ballotCount >= quorum;
  return (
    <div className="min-w-32 space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={`font-display text-sm font-semibold ${dim ? 'text-muted-foreground/50' : 'text-foreground'}`}
        >
          {petition.ballotCount.toLocaleString('uk-UA')}
          <span className="text-muted-foreground/70 ml-1 text-xs font-normal">/ {quorum}</span>
        </span>
        <span
          className={`font-body text-xs ${dim ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}
        >
          {pct}%
        </span>
      </div>
      <div className="bg-surface h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            dim ? 'bg-kpi-gray-mid/40' : 'bg-kpi-navy'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function AdminPetitionsClient({ initialPetitions }: AdminPetitionsClientProps) {
  const { toast } = useToast();
  const [petitions, setPetitions] = useState<Election[]>(initialPetitions);
  const [tab, setTab] = useState<TabKey>('pending');
  const [search, setSearch] = useState('');
  const [approving, setApproving] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Election | null>(null);
  const [deleting, setDeleting] = useState(false);

  const counts = useMemo(() => {
    const active = petitions.filter((p) => !p.deletedAt);
    return {
      pending: active.filter((p) => !p.approved).length,
      approved: active.filter((p) => p.approved).length,
      all: active.length,
      deleted: petitions.filter((p) => !!p.deletedAt).length,
    };
  }, [petitions]);

  const visible = useMemo(() => {
    let list: Election[];
    if (tab === 'deleted') list = petitions.filter((p) => !!p.deletedAt);
    else list = petitions.filter((p) => !p.deletedAt);
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

  const handleRestore = async (id: string) => {
    setRestoring(id);
    const res = await api.elections.restore(id);
    if (res.success) {
      setPetitions((prev) =>
        prev.map((p) => (p.id === id ? { ...p, deletedAt: null, deletedBy: null } : p)),
      );
      toast({ title: 'Петицію відновлено', variant: 'success' });
    } else {
      toast({ title: 'Помилка', description: res.error, variant: 'error' });
    }
    setRestoring(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await api.elections.delete(deleteTarget.id);
    if (res.success) {
      const now = new Date().toISOString();
      setPetitions((prev) =>
        prev.map((p) => (p.id === deleteTarget.id ? { ...p, deletedAt: now } : p)),
      );
      toast({ title: 'Петицію видалено', variant: 'success' });
      setDeleteTarget(null);
    } else {
      toast({ title: 'Помилка', description: res.error, variant: 'error' });
    }
    setDeleting(false);
  };

  const renderActions = (p: Election) => {
    const isDeleted = !!p.deletedAt;
    return (
      <div className="flex items-center justify-end gap-1">
        {!isDeleted && !p.approved && (
          <Button
            variant="ghost"
            size="md"
            onClick={(e) => {
              e.stopPropagation();
              handleApprove(p.id);
            }}
            loading={approving === p.id}
            className="text-success hover:bg-success-bg transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
          </Button>
        )}
        {isDeleted ? (
          p.canRestore && (
            <Button
              variant="ghost"
              size="md"
              onClick={(e) => {
                e.stopPropagation();
                handleRestore(p.id);
              }}
              loading={restoring === p.id}
              className="text-kpi-navy hover:bg-kpi-blue-light/10 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )
        ) : (
          <Button
            variant="ghost"
            size="md"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(p);
            }}
            className="text-error hover:bg-error-bg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="border-border-color shadow-shadow-sm space-y-4 rounded-xl">
        {counts.pending > 0 && (
          <Alert variant="info">
            Очікують на апрув: <strong>{counts.pending}</strong>
          </Alert>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="shrink-0 overflow-x-auto sm:max-w-full">
            <Tabs
              tabs={TABS}
              activeTab={tab}
              onTabChange={setTab}
              tabBadge={(key) => counts[key]}
            />
          </div>
          <div className="min-w-0 flex-1">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Пошук за назвою або автором…"
            />
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="border-border-color shadow-shadow-sm overflow-hidden rounded-xl border bg-white p-4 sm:p-6">
          <EmptyState
            icon={<Megaphone className="h-10 w-10" />}
            title="Петицій не знайдено"
            description={search ? 'Спробуйте інший запит.' : 'Тут поки порожньо.'}
          />
        </div>
      ) : (
        <div className="border-border-color shadow-shadow-sm overflow-hidden rounded-xl border bg-white">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-border-subtle border-b">
                  {['Назва', 'Статус', 'Створено', 'Підписи', ''].map((h) => (
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
                {visible.map((p) => {
                  const isDeleted = !!p.deletedAt;
                  return (
                    <tr
                      key={p.id}
                      className="group hover:bg-surface transition-colors duration-150"
                    >
                      <td className="max-w-xs px-4 py-3.5">
                        <Link href={`/petitions/${p.id}`} className="block">
                          <p
                            className={`font-body truncate text-sm font-medium transition-colors ${
                              isDeleted
                                ? 'text-muted-foreground/60'
                                : 'text-foreground group-hover:text-kpi-navy'
                            }`}
                          >
                            {p.title}
                          </p>
                          <p className="font-body text-muted-foreground/60 mt-0.5 truncate text-xs">
                            {p.createdBy.fullName}
                          </p>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <PetitionStatusBadge petition={p} size="md" />
                      </td>
                      <td className="px-4 py-3.5">
                        <p
                          className={`font-body text-xs ${
                            isDeleted ? 'text-muted-foreground/50' : 'text-foreground'
                          }`}
                        >
                          <LocalDateTime date={p.createdAt} />
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <ProgressCell petition={p} dim={isDeleted} />
                      </td>
                      <td className="px-4 py-3.5 text-right">{renderActions(p)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="divide-border-subtle divide-y border-t lg:hidden">
            {visible.map((p) => {
              const isDeleted = !!p.deletedAt;
              return (
                <div key={p.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/petitions/${p.id}`} className="min-w-0 flex-1">
                      <p
                        className={`font-body text-sm leading-snug font-semibold wrap-break-word ${
                          isDeleted ? 'text-muted-foreground/60' : 'text-foreground'
                        }`}
                      >
                        {p.title}
                      </p>
                      <p className="font-body text-muted-foreground/60 mt-0.5 text-xs">
                        {p.createdBy.fullName}
                      </p>
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      <PetitionStatusBadge petition={p} size="sm" />
                      {renderActions(p)}
                    </div>
                  </div>

                  <div
                    className={`font-body space-y-2 text-xs ${
                      isDeleted ? 'text-muted-foreground/50' : 'text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <LocalDateTime date={p.createdAt} />
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <ProgressCell petition={p} dim={isDeleted} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Видалити петицію?</DialogTitle>
            <DialogCloseButton onClose={() => setDeleteTarget(null)} />
          </DialogHeader>
          <DialogBody>
            <Alert variant="warning">
              <strong>{deleteTarget?.title}</strong>. Петицію можна буде відновити з вкладки
              «Видалені».
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
