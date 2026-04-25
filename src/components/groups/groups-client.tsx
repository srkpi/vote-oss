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
import { cn } from '@/lib/utils/common';
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
        'flex flex-col overflow-hidden',
      )}
    >
      <div
        className={cn(
          'h-1 bg-linear-to-r',
          group.isOwner
            ? 'from-kpi-orange to-amber-400'
            : group.isMember
              ? 'from-kpi-navy to-kpi-blue-mid'
              : 'from-kpi-gray-light to-gray-300',
        )}
      />

      <div className="flex h-full flex-col p-5">
        <div className="mb-4 flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white',
              group.isOwner ? 'bg-kpi-orange' : group.isMember ? 'navy-gradient' : 'bg-gray-400',
            )}
          >
            {group.name.charAt(0).toUpperCase()}
          </div>
          <h3 className="font-display text-foreground group-hover:text-kpi-navy line-clamp-2 text-base leading-tight font-semibold transition-colors">
            {group.name}
          </h3>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2">
          <div className="font-body text-muted-foreground flex items-center gap-1.5 rounded-full text-xs font-medium">
            <Users className="h-3 w-3" />
            <span>{group.memberCount}</span>
          </div>

          {group.isOwner && (
            <span className="font-body text-kpi-orange border-kpi-orange/30 bg-warning-bg rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
              Власник
            </span>
          )}
          {!group.isOwner && group.isMember && (
            <span className="font-body text-kpi-navy border-kpi-navy/30 bg-kpi-navy/8 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
              Учасник
            </span>
          )}
          {!group.isOwner && !group.isMember && (
            <span className="font-body rounded-full border border-gray-300 bg-gray-100 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-gray-500 uppercase">
              Публічна
            </span>
          )}
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
        title="Групи"
        description="Ваші групи та ті, що мають публічні голосування"
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
