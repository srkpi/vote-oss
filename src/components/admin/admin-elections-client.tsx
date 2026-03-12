'use client';

import { FileText, Play, StopCircle, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { ElectionStatusBadge } from '@/components/elections/election-status-badge';
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
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { SearchInput } from '@/components/ui/search-input';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { deleteElection } from '@/lib/api-client';
import { formatDateTime } from '@/lib/utils';
import type { Admin } from '@/types/admin';
import type { Election, ElectionStatus } from '@/types/election';

interface AdminElectionsClientProps {
  elections: Election[];
  error: string | null;
  currentAdmin: Admin | null;
}

type TabKey = 'all' | ElectionStatus;

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'Усі' },
  { key: 'open', label: 'Активні' },
  { key: 'upcoming', label: 'Майбутні' },
  { key: 'closed', label: 'Завершені' },
];

function canAdminDeleteElection(admin: Admin | null, election: Election): boolean {
  if (!admin) return false;
  if (!admin.restricted_to_faculty) return true;
  return election.restrictedToFaculty === admin.faculty;
}

export function AdminElectionsClient({
  elections,
  error,
  currentAdmin,
}: AdminElectionsClientProps) {
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

    const result = await deleteElection(deleteTarget.id);
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
      <div
        className="space-y-4 animate-fade-up"
        style={{ animationDelay: '200ms', animationFillMode: 'both' }}
      >
        {/* Toolbar */}
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

        {/* Content */}
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
            {/* Desktop table */}
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
                      canDelete={canAdminDeleteElection(currentAdmin, election)}
                      onDelete={() => setDeleteTarget(election)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / tablet cards */}
            <div className="lg:hidden divide-y divide-[var(--border-subtle)]">
              {filtered.map((election) => (
                <ElectionMobileCard
                  key={election.id}
                  election={election}
                  canDelete={canAdminDeleteElection(currentAdmin, election)}
                  onDelete={() => setDeleteTarget(election)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Видалити голосування?</DialogTitle>
            <DialogCloseButton onClose={() => setDeleteTarget(null)} />
          </DialogHeader>
          <DialogBody>
            <Alert variant="warning">
              Голосування <strong>«{deleteTarget?.title}»</strong> та всі пов&apos;язані бюлетені
              будуть видалені. Цю дію неможливо скасувати.
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

// ── Row / card sub-components ─────────────────────────────────────────────────

interface ElectionRowProps {
  election: Election;
  canDelete: boolean;
  onDelete: () => void;
}

function ElectionRow({ election, canDelete, onDelete }: ElectionRowProps) {
  const router = useRouter();

  return (
    <tr className="hover:bg-[var(--surface)] transition-colors duration-150 group">
      <td
        className="px-4 py-3.5 max-w-xs cursor-pointer"
        onClick={() => router.push(`/admin/elections/${election.id}`)}
      >
        <div>
          <p className="text-sm font-medium font-body text-[var(--foreground)] truncate group-hover:text-[var(--kpi-navy)] transition-colors">
            {election.title}
          </p>
          <p className="text-xs font-body text-[var(--muted-foreground)] mt-0.5 truncate">
            {election.creator.full_name}
          </p>
        </div>
      </td>
      <td
        className="px-4 py-3.5 cursor-pointer"
        onClick={() => router.push(`/admin/elections/${election.id}`)}
      >
        <ElectionStatusBadge status={election.status} size="md" />
      </td>
      <td
        className="px-4 py-3.5 cursor-pointer"
        onClick={() => router.push(`/admin/elections/${election.id}`)}
      >
        <p className="text-xs font-body text-[var(--foreground)]">
          {formatDateTime(election.opensAt)}
        </p>
      </td>
      <td
        className="px-4 py-3.5 cursor-pointer"
        onClick={() => router.push(`/admin/elections/${election.id}`)}
      >
        <p className="text-xs font-body text-[var(--foreground)]">
          {formatDateTime(election.closesAt)}
        </p>
      </td>
      <td
        className="px-4 py-3.5 cursor-pointer"
        onClick={() => router.push(`/admin/elections/${election.id}`)}
      >
        <div className="flex items-center gap-1.5">
          <span className="font-display text-xl font-bold text-[var(--foreground)]">
            {election.ballotCount.toLocaleString('uk-UA')}
          </span>
          {election.status === 'open' && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse shrink-0" />
          )}
        </div>
      </td>
      <td
        className="px-4 py-3.5 cursor-pointer"
        onClick={() => router.push(`/admin/elections/${election.id}`)}
      >
        <div className="flex flex-col gap-1">
          {election.restrictedToFaculty || election.restrictedToGroup ? (
            <>
              {election.restrictedToFaculty && (
                <Badge variant="info" size="md">
                  {election.restrictedToFaculty}
                </Badge>
              )}
              {election.restrictedToGroup && (
                <Badge variant="secondary" size="md">
                  {election.restrictedToGroup}
                </Badge>
              )}
            </>
          ) : (
            <Badge variant="success" size="md">
              Всі
            </Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-3.5 text-right">
        {canDelete && (
          <Button
            variant="ghost"
            size="md"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-[var(--error)] hover:bg-[var(--error-bg)] transition-opacity"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </td>
    </tr>
  );
}

function ElectionMobileCard({ election, canDelete, onDelete }: ElectionRowProps) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/admin/elections/${election.id}`} className="flex-1 min-w-0">
          <div>
            <p className="text-sm font-semibold font-body text-[var(--foreground)] leading-snug break-words">
              {election.title}
            </p>
            <p className="text-xs font-body text-[var(--muted-foreground)] mt-0.5">
              {election.creator.full_name}
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          <ElectionStatusBadge status={election.status} size="sm" />
          {canDelete && (
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
      </div>

      <Link href={`/admin/elections/${election.id}`}>
        <div className="text-xs font-body text-[var(--muted-foreground)] space-y-1.5 mt-2">
          <div className="flex items-center gap-2">
            <Play className="w-3.5 h-3.5 shrink-0" />
            <span>{formatDateTime(election.opensAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <StopCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{formatDateTime(election.closesAt)}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold text-[var(--foreground)]">{election.ballotCount}</span>
            Голосів
            {(election.restrictedToFaculty || election.restrictedToGroup) && (
              <Badge variant="info" size="sm" className="ml-2">
                {election.restrictedToGroup ?? election.restrictedToFaculty}
              </Badge>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
