'use client';

import { Crown, ExternalLink, ShieldCheck, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
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
import { StyledSelect } from '@/components/ui/styled-select';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import { pluralize } from '@/lib/utils/common';
import type { AdminGroupSummary, GroupType } from '@/types/group';
import { GROUP_TYPE_LABELS } from '@/types/group';

interface AdminGroupsClientProps {
  initialGroups: AdminGroupSummary[];
  error: string | null;
}

interface TypeChange {
  group: AdminGroupSummary;
  nextType: GroupType;
}

export function AdminGroupsClient({ initialGroups, error }: AdminGroupsClientProps) {
  const { toast } = useToast();
  const [groups, setGroups] = useState<AdminGroupSummary[]>(initialGroups);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminGroupSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [typeChange, setTypeChange] = useState<TypeChange | null>(null);
  const [savingType, setSavingType] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase().trim();
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.ownerName ?? '').toLowerCase().includes(q) ||
        g.ownerId.toLowerCase().includes(q),
    );
  }, [groups, search]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await api.groups.delete(deleteTarget.id);
    if (result.success) {
      toast({ title: 'Групу видалено', variant: 'success' });
      setGroups((prev) => prev.filter((g) => g.id !== deleteTarget.id));
      setDeleteTarget(null);
    } else {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
    }
    setDeleting(false);
  };

  const handleTypeChange = async () => {
    if (!typeChange) return;
    setSavingType(true);
    const result = await api.groups.setType(typeChange.group.id, typeChange.nextType);
    if (result.success) {
      toast({
        title: 'Тип групи оновлено',
        description: `${typeChange.group.name} — ${GROUP_TYPE_LABELS[typeChange.nextType]}`,
        variant: 'success',
      });
      setGroups((prev) =>
        prev.map((g) => (g.id === typeChange.group.id ? { ...g, type: typeChange.nextType } : g)),
      );
      setTypeChange(null);
    } else {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
    }
    setSavingType(false);
  };

  return (
    <div className="border-border-color shadow-shadow-card overflow-hidden rounded-xl border bg-white">
      <div className="border-border-subtle flex flex-col gap-4 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <div className="navy-gradient flex h-8 w-8 items-center justify-center rounded-lg">
            <Users className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="font-display text-foreground text-base font-semibold sm:text-lg">
              Групи
            </h2>
            <p className="font-body text-muted-foreground text-xs">
              {pluralize(groups.length, ['група', 'групи', 'груп'])} у системі
            </p>
          </div>
        </div>

        {/* Added w-full for mobile so the search bar feels natural on its own row */}
        <div className="w-full sm:w-64">
          <SearchInput value={search} onChange={setSearch} placeholder="Пошук груп…" />
        </div>
      </div>

      {error && (
        <div className="p-4 sm:p-6">
          <Alert variant="error" title="Помилка завантаження">
            {error}
          </Alert>
        </div>
      )}

      {!error && filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title={search ? 'Груп не знайдено' : 'Немає груп'}
          description={search ? `За запитом «${search}» нічого не знайдено` : undefined}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-border-subtle border-b">
                  {['Назва', 'Тип', 'Власник', 'Учасники', ''].map((h) => (
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
                {filtered.map((group) => (
                  <tr key={group.id} className="hover:bg-surface group transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="navy-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white">
                          {group.name.charAt(0)}
                        </div>
                        <p className="font-body text-foreground max-w-xs truncate text-sm font-medium">
                          {group.name}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <GroupTypeSelect
                        value={group.type}
                        onChange={(nextType) => {
                          if (nextType !== group.type) setTypeChange({ group, nextType });
                        }}
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-body text-foreground text-sm">
                        {group.ownerName ?? (
                          <span className="text-muted-foreground font-mono text-xs">
                            {group.ownerId}
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-body text-foreground text-sm">{group.memberCount}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/groups/${group.id}`} target="_blank">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(group)}
                          className="text-error hover:bg-error-bg"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 p-4 lg:hidden">
            {filtered.map((group) => (
              <div
                key={group.id}
                className="border-border-color shadow-shadow-sm rounded-lg border bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="navy-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white">
                      {group.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-body text-foreground text-sm font-semibold">
                        {group.name}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1">
                        <Crown className="text-kpi-orange h-3 w-3" />
                        <p className="font-body text-muted-foreground text-xs">
                          {group.ownerName ?? group.ownerId}
                        </p>
                      </div>
                      <p className="font-body text-muted-foreground mt-0.5 text-xs">
                        {pluralize(group.memberCount, ['учасник', 'учасники', 'учасників'])}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="xs" asChild>
                      <Link href={`/groups/${group.id}`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setDeleteTarget(group)}
                      className="text-error hover:bg-error-bg"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-muted-foreground mb-1 text-xs">Тип групи</p>
                  <GroupTypeSelect
                    value={group.type}
                    onChange={(nextType) => {
                      if (nextType !== group.type) setTypeChange({ group, nextType });
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Видалити групу?</DialogTitle>
            <DialogCloseButton onClose={() => setDeleteTarget(null)} />
          </DialogHeader>
          <DialogBody>
            <Alert variant="warning">
              Група <strong>«{deleteTarget?.name}»</strong> буде видалена. Усі учасники втратять
              членство. Цю дію неможливо скасувати.
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

      {/* Type change confirm */}
      <Dialog open={!!typeChange} onClose={() => !savingType && setTypeChange(null)}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Змінити тип групи?</DialogTitle>
            <DialogCloseButton onClose={() => setTypeChange(null)} />
          </DialogHeader>
          <DialogBody>
            {typeChange?.nextType === 'VKSU' ? (
              <Alert variant="warning" title="Учасники отримають права ВКСУ">
                Усі активні учасники групи <strong>«{typeChange?.group.name}»</strong> зможуть
                створювати форми реєстрації кандидатів і керувати ними.
              </Alert>
            ) : (
              <Alert variant="info">
                Група <strong>«{typeChange?.group.name}»</strong> більше не вважатиметься ВКСУ.
                Учасники втратять права на створення форм реєстрації.
              </Alert>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setTypeChange(null)} disabled={savingType}>
              Скасувати
            </Button>
            <Button variant="primary" onClick={handleTypeChange} loading={savingType}>
              Підтвердити
            </Button>
          </DialogFooter>
        </DialogPanel>
      </Dialog>
    </div>
  );
}

interface GroupTypeSelectProps {
  value: GroupType;
  onChange: (next: GroupType) => void;
}

function GroupTypeSelect({ value, onChange }: GroupTypeSelectProps) {
  return (
    <div className="inline-flex items-center gap-2">
      {value === 'VKSU' && <ShieldCheck className="text-kpi-navy h-3.5 w-3.5" />}
      <StyledSelect
        value={value}
        onChange={(v) => onChange(v as GroupType)}
        className="w-44"
        options={[
          { value: 'OTHER', label: GROUP_TYPE_LABELS.OTHER },
          { value: 'VKSU', label: GROUP_TYPE_LABELS.VKSU },
        ]}
      />
    </div>
  );
}
