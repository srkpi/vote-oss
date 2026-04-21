'use client';

import { Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
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
import { FormField, Input } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import { GROUP_NAME_MAX_LENGTH } from '@/lib/constants';
import { cn, pluralize } from '@/lib/utils/common';
import type { Group } from '@/types/group';

interface GroupsClientProps {
  initialGroups: Group[];
  canCreateGroups: boolean;
  error: string | null;
}

function GroupCard({ group }: { group: Group }) {
  return (
    <Link
      href={`/groups/${group.id}`}
      className={cn(
        'group border-border-color shadow-shadow-card block rounded-xl border bg-white',
        'hover:shadow-shadow-card-hover transition-all duration-200 hover:-translate-y-0.5',
        'overflow-hidden',
      )}
    >
      <div
        className={cn(
          'h-1',
          group.isOwner
            ? 'from-kpi-orange bg-linear-to-r to-amber-400'
            : 'from-kpi-navy to-kpi-blue-mid bg-linear-to-r',
        )}
      />
      <div className="p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white',
              group.isOwner ? 'bg-kpi-orange' : 'navy-gradient',
            )}
          >
            {group.name.charAt(0).toUpperCase()}
          </div>
          {group.isOwner && (
            <span className="font-body text-kpi-orange border-kpi-orange/30 bg-warning-bg rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
              Власник
            </span>
          )}
        </div>

        <h3 className="font-display text-foreground group-hover:text-kpi-navy mb-1 truncate text-base font-semibold transition-colors">
          {group.name}
        </h3>

        <div className="font-body text-muted-foreground flex items-center gap-1.5 text-sm">
          <Users className="h-3.5 w-3.5" />
          <span>{pluralize(group.memberCount, ['учасник', 'учасники', 'учасників'])}</span>
        </div>
      </div>
    </Link>
  );
}

export function GroupsClient({ initialGroups, canCreateGroups, error }: GroupsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    setCreateError(null);

    const result = await api.groups.create(trimmed);
    if (result.success) {
      toast({ title: 'Групу створено', variant: 'success' });
      setGroups((prev) => [result.data, ...prev]);
      setCreateOpen(false);
      setName('');
      router.push(`/groups/${result.data.id}`);
    } else {
      setCreateError(result.error);
    }
    setCreating(false);
  };

  const handleClose = () => {
    setCreateOpen(false);
    setName('');
    setCreateError(null);
  };

  return (
    <>
      <PageHeader
        title="Мої групи"
        description="Групи, до яких ви належите або якими керуєте"
        isContainer
      >
        {canCreateGroups && (
          <Button variant="accent" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Нова група</span>
          </Button>
        )}
      </PageHeader>
      <div className="container py-8">
        {error && (
          <Alert variant="error" title="Помилка завантаження" className="mb-6">
            {error}
          </Alert>
        )}

        {!error && groups.length === 0 ? (
          <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white">
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title="Ви не належите до жодної з груп"
              description={
                canCreateGroups
                  ? 'Створіть групу або приєднайтесь за запрошенням від власника'
                  : 'Адміністратори платформи можуть вас запросити'
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        )}

        <Dialog open={createOpen} onClose={handleClose}>
          <DialogPanel maxWidth="sm">
            <DialogHeader>
              <DialogTitle>Нова група</DialogTitle>
              <DialogCloseButton onClose={handleClose} />
            </DialogHeader>
            <DialogBody className="space-y-4">
              {createError && (
                <Alert variant="error" onDismiss={() => setCreateError(null)}>
                  {createError}
                </Alert>
              )}
              <FormField label="Назва групи" required htmlFor="group-name">
                <Input
                  id="group-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Наприклад: Студрада ФІОТ"
                  maxLength={GROUP_NAME_MAX_LENGTH}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && name.trim()) handleCreate();
                  }}
                />
              </FormField>
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={handleClose} disabled={creating}>
                Скасувати
              </Button>
              <Button
                variant="accent"
                onClick={handleCreate}
                loading={creating}
                disabled={!name.trim()}
              >
                Створити
              </Button>
            </DialogFooter>
          </DialogPanel>
        </Dialog>
      </div>
    </>
  );
}
