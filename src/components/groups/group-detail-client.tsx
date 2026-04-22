'use client';

import {
  ArrowRightLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Crown,
  Key,
  LogOut,
  Pencil,
  Plus,
  Trash2,
  UserMinus,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
import { KyivDateTimePicker } from '@/components/ui/kyiv-date-time-picker';
import { LocalDateTime } from '@/components/ui/local-time';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import {
  GROUP_INVITE_LINK_MAX_DAYS,
  GROUP_INVITE_LINK_MAX_USAGE,
  GROUP_INVITE_LINK_MIN_HOURS,
  GROUP_NAME_MAX_LENGTH,
} from '@/lib/constants';
import { cn, pluralize } from '@/lib/utils/common';
import type { User } from '@/types/auth';
import type { GroupDetail, GroupInviteLink, GroupMemberSummary } from '@/types/group';

// ────────────────────────────────────────────────────────────────────────────
// Invite link token result card
// ────────────────────────────────────────────────────────────────────────────

function InviteLinkResult({ token }: { token: string }) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const link =
    typeof window !== 'undefined'
      ? `${window.location.origin}/groups/join/${encodeURIComponent(token)}`
      : `/groups/join/${encodeURIComponent(token)}`;

  const copy = async (text: string, setFn: (v: boolean) => void) => {
    await navigator.clipboard.writeText(text);
    setFn(true);
    setTimeout(() => setFn(false), 2000);
  };

  return (
    <div className="space-y-4">
      <Alert variant="success" title="Посилання створено">
        Скопіюйте посилання та поділіться ним.
      </Alert>
      <div>
        <p className="font-body text-muted-foreground mb-1.5 text-xs font-semibold tracking-wider uppercase">
          Посилання для вступу
        </p>
        <div className="flex items-center gap-2">
          <div className="bg-surface flex-1 overflow-hidden rounded border p-2.5">
            <p className="font-mono text-xs break-all select-all">{link}</p>
          </div>
          <Button
            variant={copiedLink ? 'secondary' : 'outline'}
            size="icon"
            onClick={() => copy(link, setCopiedLink)}
          >
            {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div>
        <p className="font-body text-muted-foreground mb-1.5 text-xs font-semibold tracking-wider uppercase">
          Токен
        </p>
        <div className="flex items-center gap-2">
          <div className="bg-surface flex-1 overflow-hidden rounded border p-2.5">
            <p className="font-mono text-xs break-all select-all">{token}</p>
          </div>
          <Button
            variant={copiedToken ? 'secondary' : 'outline'}
            size="icon"
            onClick={() => copy(token, setCopiedToken)}
          >
            {copiedToken ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Invite link card
// ────────────────────────────────────────────────────────────────────────────

function InviteLinkCard({ link, onRevoke }: { link: GroupInviteLink; onRevoke: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const isExpired = new Date(link.expiresAt) < new Date();
  const isExhausted = link.currentUsage >= link.maxUsage;
  const isRevoked = !!link.deletedAt;
  const isInactive = isExpired || isExhausted || isRevoked;

  return (
    <div
      className={cn(
        'border-border-color overflow-hidden rounded-xl border bg-white',
        isInactive && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0 flex-1 space-y-1">
          {link.label && (
            <p className="font-body text-foreground text-sm font-medium">{link.label}</p>
          )}
          <p className="font-body text-muted-foreground text-xs">
            Використань: {link.currentUsage} / {link.maxUsage}
          </p>
          <p className="font-body text-muted-foreground text-xs">
            Дійсне до: <LocalDateTime date={link.expiresAt} />
          </p>
          {isRevoked && (
            <p className="font-body text-error text-xs">
              Відкликано: <LocalDateTime date={link.deletedAt!} />
            </p>
          )}
          {isExpired && !isRevoked && (
            <p className="font-body text-muted-foreground text-xs">Термін дії минув</p>
          )}
          {isExhausted && !isRevoked && (
            <p className="font-body text-muted-foreground text-xs">Ліміт використань вичерпано</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {link.usages.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setExpanded((v) => !v)}
              className="text-muted-foreground"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
          {link.canRevoke && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onRevoke}
              className="text-error hover:bg-error-bg"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {expanded && link.usages.length > 0 && (
        <div className="border-border-subtle border-t p-4">
          <p className="font-body text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
            Хто вступив
          </p>
          <div className="space-y-1.5">
            {link.usages.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-2">
                <p className="text-foreground font-mono text-xs">{u.userId}</p>
                <p className="font-body text-muted-foreground text-xs">
                  <LocalDateTime date={u.usedAt} />
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

interface GroupDetailClientProps {
  group: GroupDetail;
  session: User;
}

export function GroupDetailClient({ group: initialGroup, session }: GroupDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [group, setGroup] = useState<GroupDetail>(initialGroup);

  const isOwner = group.ownerId === session.userId;
  const isAdminWithManageGroups = session.isAdmin && session.manageGroups;
  const canManage = isOwner || isAdminWithManageGroups;

  // ── Rename ────────────────────────────────────────────────────────────────
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState(group.name);
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const handleRename = async () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === group.name) return;
    setRenaming(true);
    setRenameError(null);
    const result = await api.groups.rename(group.id, trimmed);
    if (result.success) {
      setGroup((prev) => ({ ...prev, name: trimmed }));
      toast({ title: 'Назву оновлено', variant: 'success' });
      setRenameOpen(false);
    } else {
      setRenameError(result.error);
    }
    setRenaming(false);
  };

  // ── Delete group ──────────────────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const result = await api.groups.delete(group.id);
    if (result.success) {
      toast({ title: 'Групу видалено', variant: 'success' });
      router.push('/groups');
    } else {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  // ── Kick / leave ──────────────────────────────────────────────────────────
  const [kickTarget, setKickTarget] = useState<GroupMemberSummary | null>(null);
  const [kicking, setKicking] = useState(false);
  const isSelfLeave = kickTarget?.userId === session.userId;

  const handleKickConfirm = async () => {
    if (!kickTarget) return;
    setKicking(true);
    const result = await api.groups.members.remove(group.id, kickTarget.userId);
    if (result.success) {
      toast({
        title: isSelfLeave ? 'Ви вийшли з групи' : 'Учасника видалено',
        variant: 'success',
      });
      if (isSelfLeave) {
        router.push('/groups');
      } else {
        setGroup((prev) => ({
          ...prev,
          members: prev.members.filter((m) => m.userId !== kickTarget.userId),
          memberCount: prev.memberCount - 1,
        }));
        setKickTarget(null);
      }
    } else {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
    }
    setKicking(false);
  };

  // ── Transfer ownership ────────────────────────────────────────────────────
  const [transferOpen, setTransferOpen] = useState(false);
  const [selectedNewOwner, setSelectedNewOwner] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  const transferCandidates = group.members.filter((m) => m.userId !== session.userId && !m.isOwner);

  const handleTransfer = async () => {
    if (!selectedNewOwner) return;
    setTransferring(true);
    setTransferError(null);
    const result = await api.groups.transfer(group.id, selectedNewOwner);
    if (result.success) {
      toast({ title: 'Власника змінено', variant: 'success' });
      setGroup((prev) => ({
        ...prev,
        ownerId: selectedNewOwner,
        isOwner: session.userId === selectedNewOwner,
        members: prev.members.map((m) => ({ ...m, isOwner: m.userId === selectedNewOwner })),
      }));
      setTransferOpen(false);
      setSelectedNewOwner('');
    } else {
      setTransferError(result.error);
    }
    setTransferring(false);
  };

  // ── Invite link create ────────────────────────────────────────────────────
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLabel, setInviteLabel] = useState('');
  const [inviteMaxUsage, setInviteMaxUsage] = useState(10);
  const [inviteCreating, setInviteCreating] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const minDate = new Date(now.getTime() + GROUP_INVITE_LINK_MIN_HOURS * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
  const maxDate = new Date(now.getTime() + GROUP_INVITE_LINK_MAX_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
  const [inviteExpiresAt, setInviteExpiresAt] = useState(tomorrow);

  const handleCreateInvite = async () => {
    setInviteCreating(true);
    setInviteError(null);
    const result = await api.groups.inviteLinks.create(group.id, {
      label: inviteLabel.trim() || undefined,
      maxUsage: inviteMaxUsage,
      expiresAt: new Date(inviteExpiresAt).toISOString(),
    });
    if (result.success) {
      setInviteToken(result.data.token);
      // Add new link to state (without token)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token: _t, ...linkWithoutToken } = result.data;
      setGroup((prev) => ({
        ...prev,
        inviteLinks: [linkWithoutToken, ...prev.inviteLinks],
      }));
    } else {
      setInviteError(result.error);
    }
    setInviteCreating(false);
  };

  const handleCloseInvite = () => {
    setInviteOpen(false);
    setInviteLabel('');
    setInviteMaxUsage(10);
    setInviteExpiresAt(tomorrow);
    setInviteToken(null);
    setInviteError(null);
  };

  // ── Revoke invite link ────────────────────────────────────────────────────
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    const result = await api.groups.inviteLinks.revoke(group.id, revokeTarget);
    if (result.success) {
      toast({ title: 'Посилання відкликано', variant: 'success' });
      setGroup((prev) => ({
        ...prev,
        inviteLinks: prev.inviteLinks.map((l) =>
          l.id === revokeTarget
            ? { ...l, deletedAt: new Date().toISOString(), canRevoke: false }
            : l,
        ),
      }));
      setRevokeTarget(null);
    } else {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
    }
    setRevoking(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        nav={[{ label: 'Групи', href: '/groups' }, { label: group.name }]}
        title={group.name}
        isContainer
      />

      <div className="container py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Members panel */}
          <div className="space-y-6 lg:col-span-2">
            <div className="border-border-color shadow-shadow-card overflow-hidden rounded-xl border bg-white">
              <div className="border-border-subtle flex items-center justify-between border-b px-5 py-4">
                <div className="flex items-center gap-2">
                  <Users className="text-kpi-gray-mid h-4 w-4" />
                  <h2 className="font-display text-foreground text-base font-semibold">Учасники</h2>
                </div>
              </div>

              <div className="divide-border-subtle divide-y">
                {group.members.map((member) => {
                  const isSelf = member.userId === session.userId;
                  const canKick = !isSelf && canManage && !member.isOwner;
                  const canLeave = isSelf && !isOwner;

                  return (
                    <div key={member.userId} className="flex items-center gap-3 px-5 py-3.5">
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white',
                          member.isOwner ? 'bg-kpi-orange' : 'navy-gradient',
                        )}
                      >
                        {member.displayName.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-body text-foreground truncate text-sm font-medium">
                            {member.displayName}
                          </p>
                          {member.isOwner && (
                            <Crown className="text-kpi-orange h-3.5 w-3.5 shrink-0" />
                          )}
                          {isSelf && (
                            <span className="font-body text-muted-foreground text-xs">(ви)</span>
                          )}
                        </div>
                        <p className="font-body text-muted-foreground text-xs">
                          З <LocalDateTime date={member.joinedAt} />
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {canKick && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setKickTarget(member)}
                            className="text-error hover:bg-error-bg"
                            title="Видалити з групи"
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canLeave && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setKickTarget(member)}
                            className="text-muted-foreground hover:text-error hover:bg-error-bg"
                            title="Вийти з групи"
                          >
                            <LogOut className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Invite links panel — only for owner/admin */}
            {canManage && (
              <div className="border-border-color shadow-shadow-card overflow-hidden rounded-xl border bg-white">
                <div className="border-border-subtle flex items-center justify-between border-b px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Key className="text-kpi-gray-mid h-4 w-4" />
                    <h2 className="font-display text-foreground text-base font-semibold">
                      Запрошення
                    </h2>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setInviteOpen(true)}
                    icon={<Plus className="h-3.5 w-3.5" />}
                  >
                    <span className="hidden sm:inline">Нове посилання</span>
                  </Button>
                </div>

                <div className="p-4 sm:p-5">
                  {group.inviteLinks.length === 0 ? (
                    <p className="font-body text-muted-foreground py-4 text-center text-sm">
                      Немає посилань для запрошення
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {group.inviteLinks.map((link) => (
                        <InviteLinkCard
                          key={link.id}
                          link={link}
                          onRevoke={() => setRevokeTarget(link.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: group info + actions */}
          <div className="space-y-4">
            <div className="border-border-color shadow-shadow-card overflow-hidden rounded-xl border bg-white p-5">
              <h3 className="font-display text-foreground mb-4 text-base font-semibold">
                Деталі групи
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-body text-muted-foreground mb-0.5 text-xs font-semibold tracking-wider uppercase">
                    Власник
                  </p>
                  <p className="font-body text-foreground">
                    {group.members.find((m) => m.isOwner)?.displayName ?? group.ownerId}
                  </p>
                </div>
                <div>
                  <p className="font-body text-muted-foreground mb-0.5 text-xs font-semibold tracking-wider uppercase">
                    Учасників
                  </p>
                  <p className="font-body text-foreground">
                    {pluralize(group.memberCount, ['учасник', 'учасники', 'учасників'])}
                  </p>
                </div>
              </div>
            </div>

            {/* Owner actions */}
            {isOwner && (
              <div className="border-border-color shadow-shadow-card space-y-3 overflow-hidden rounded-xl border bg-white p-5">
                <h3 className="font-display text-foreground text-base font-semibold">Керування</h3>

                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    setNewName(group.name);
                    setRenameOpen(true);
                  }}
                  icon={<Pencil className="h-3.5 w-3.5" />}
                >
                  Перейменувати
                </Button>

                {transferCandidates.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    onClick={() => setTransferOpen(true)}
                    icon={<ArrowRightLeft className="h-3.5 w-3.5" />}
                  >
                    Передати права
                  </Button>
                )}

                <Button
                  variant="danger"
                  size="sm"
                  fullWidth
                  onClick={() => setDeleteOpen(true)}
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                >
                  Видалити групу
                </Button>
              </div>
            )}

            {/* Admin takeover */}
            {isAdminWithManageGroups && !isOwner && (
              <div className="border-border-color shadow-shadow-card space-y-3 overflow-hidden rounded-xl border bg-white p-5">
                <h3 className="font-display text-foreground text-base font-semibold">
                  Адмін-керування
                </h3>
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => setTransferOpen(true)}
                  icon={<Crown className="h-3.5 w-3.5" />}
                >
                  Взяти право власника
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  fullWidth
                  onClick={() => setDeleteOpen(true)}
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                >
                  Видалити групу
                </Button>
              </div>
            )}

            {/* Non-owner leave button */}
            {!isOwner && group.isMember && (
              <Button
                variant="danger"
                size="sm"
                fullWidth
                onClick={() =>
                  setKickTarget(group.members.find((m) => m.userId === session.userId) ?? null)
                }
                icon={<LogOut className="h-3.5 w-3.5" />}
              >
                Вийти з групи
              </Button>
            )}
          </div>

          {/* ── Dialogs ─────────────────────────────────────────────────────── */}

          {/* Rename */}
          <Dialog open={renameOpen} onClose={() => setRenameOpen(false)}>
            <DialogPanel maxWidth="sm">
              <DialogHeader>
                <DialogTitle>Перейменувати групу</DialogTitle>
                <DialogCloseButton onClose={() => setRenameOpen(false)} />
              </DialogHeader>
              <DialogBody className="space-y-4">
                {renameError && (
                  <Alert variant="error" onDismiss={() => setRenameError(null)}>
                    {renameError}
                  </Alert>
                )}
                <FormField label="Нова назва" required htmlFor="rename-group">
                  <Input
                    id="rename-group"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    maxLength={GROUP_NAME_MAX_LENGTH}
                    autoFocus
                  />
                </FormField>
              </DialogBody>
              <DialogFooter>
                <Button
                  variant="secondary"
                  onClick={() => setRenameOpen(false)}
                  disabled={renaming}
                >
                  Скасувати
                </Button>
                <Button
                  variant="primary"
                  onClick={handleRename}
                  loading={renaming}
                  disabled={!newName.trim() || newName.trim() === group.name}
                >
                  Зберегти
                </Button>
              </DialogFooter>
            </DialogPanel>
          </Dialog>

          {/* Delete */}
          <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
            <DialogPanel maxWidth="sm">
              <DialogHeader>
                <DialogTitle>Видалити групу?</DialogTitle>
                <DialogCloseButton onClose={() => setDeleteOpen(false)} />
              </DialogHeader>
              <DialogBody>
                <Alert variant="warning">
                  Група <strong>«{group.name}»</strong> буде видалена. Учасники втратять членство.
                  Цю дію неможливо скасувати.
                </Alert>
              </DialogBody>
              <DialogFooter>
                <Button
                  variant="secondary"
                  onClick={() => setDeleteOpen(false)}
                  disabled={deleting}
                >
                  Скасувати
                </Button>
                <Button variant="danger" onClick={handleDelete} loading={deleting}>
                  Видалити
                </Button>
              </DialogFooter>
            </DialogPanel>
          </Dialog>

          {/* Kick / leave confirm */}
          <Dialog open={!!kickTarget} onClose={() => setKickTarget(null)}>
            <DialogPanel maxWidth="sm">
              <DialogHeader>
                <DialogTitle>{isSelfLeave ? 'Вийти з групи?' : 'Видалити учасника?'}</DialogTitle>
                <DialogCloseButton onClose={() => setKickTarget(null)} />
              </DialogHeader>
              <DialogBody>
                <Alert variant="warning">
                  {isSelfLeave
                    ? `Ви покинете групу «${group.name}». Щоб повернутися, знадобиться нове запрошення.`
                    : `«${kickTarget?.displayName}» буде видалено з групи.`}
                </Alert>
              </DialogBody>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setKickTarget(null)} disabled={kicking}>
                  Скасувати
                </Button>
                <Button variant="danger" onClick={handleKickConfirm} loading={kicking}>
                  {isSelfLeave ? 'Вийти' : 'Видалити'}
                </Button>
              </DialogFooter>
            </DialogPanel>
          </Dialog>

          {/* Transfer ownership */}
          <Dialog
            open={transferOpen}
            onClose={() => {
              setTransferOpen(false);
              setSelectedNewOwner('');
              setTransferError(null);
            }}
          >
            <DialogPanel maxWidth="sm">
              <DialogHeader>
                <DialogTitle>
                  {isAdminWithManageGroups && !isOwner ? 'Взяти право власника' : 'Передати права'}
                </DialogTitle>
                <DialogCloseButton
                  onClose={() => {
                    setTransferOpen(false);
                    setSelectedNewOwner('');
                    setTransferError(null);
                  }}
                />
              </DialogHeader>
              <DialogBody className="space-y-4">
                {transferError && (
                  <Alert variant="error" onDismiss={() => setTransferError(null)}>
                    {transferError}
                  </Alert>
                )}
                {isAdminWithManageGroups && !isOwner ? (
                  <Alert variant="info">
                    Як адміністратор з правами керування групами, ви можете перейняти власність цієї
                    групи.
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    <label className="font-body text-foreground block text-sm font-medium">
                      Новий власник <span className="text-error">*</span>
                    </label>
                    <select
                      value={selectedNewOwner}
                      onChange={(e) => setSelectedNewOwner(e.target.value)}
                      className="border-border-color focus:ring-kpi-blue-light/20 focus:border-kpi-blue-light w-full rounded-(--radius) border bg-white px-3 py-2.5 text-sm transition-colors focus:ring-2 focus:outline-none"
                    >
                      <option value="">Оберіть учасника…</option>
                      {transferCandidates.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </DialogBody>
              <DialogFooter>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTransferOpen(false);
                    setSelectedNewOwner('');
                    setTransferError(null);
                  }}
                  disabled={transferring}
                >
                  Скасувати
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    if (isAdminWithManageGroups && !isOwner) {
                      handleTransfer();
                      // Admin transfers to themselves
                      setSelectedNewOwner(session.userId);
                    } else {
                      handleTransfer();
                    }
                  }}
                  loading={transferring}
                  disabled={!(isAdminWithManageGroups && !isOwner) && !selectedNewOwner}
                >
                  {isAdminWithManageGroups && !isOwner ? 'Перейняти власність' : 'Передати'}
                </Button>
              </DialogFooter>
            </DialogPanel>
          </Dialog>

          {/* Create invite link */}
          <Dialog open={inviteOpen} onClose={handleCloseInvite}>
            <DialogPanel maxWidth="md">
              <DialogHeader>
                <DialogTitle>Нове запрошення</DialogTitle>
                <DialogCloseButton onClose={handleCloseInvite} />
              </DialogHeader>
              <DialogBody className="space-y-4">
                {inviteError && (
                  <Alert variant="error" onDismiss={() => setInviteError(null)}>
                    {inviteError}
                  </Alert>
                )}
                {!inviteToken ? (
                  <>
                    <FormField label="Назва (необов'язково)" htmlFor="invite-label">
                      <Input
                        id="invite-label"
                        value={inviteLabel}
                        onChange={(e) => setInviteLabel(e.target.value)}
                        placeholder="Наприклад: Для нових студентів"
                      />
                    </FormField>
                    <FormField label="Максимум використань" required htmlFor="invite-max-usage">
                      <Input
                        id="invite-max-usage"
                        type="number"
                        min={1}
                        max={GROUP_INVITE_LINK_MAX_USAGE}
                        value={inviteMaxUsage}
                        onChange={(e) =>
                          setInviteMaxUsage(Math.max(1, parseInt(e.target.value) || 1))
                        }
                      />
                    </FormField>
                    <FormField label="Дійсне до" required htmlFor="invite-expires">
                      <KyivDateTimePicker
                        id="invite-expires"
                        value={inviteExpiresAt}
                        min={minDate}
                        max={maxDate}
                        onChange={(date) => setInviteExpiresAt(date.toISOString())}
                      />
                    </FormField>
                  </>
                ) : (
                  <InviteLinkResult token={inviteToken} />
                )}
              </DialogBody>
              <DialogFooter>
                {!inviteToken ? (
                  <>
                    <Button
                      variant="secondary"
                      onClick={handleCloseInvite}
                      disabled={inviteCreating}
                    >
                      Скасувати
                    </Button>
                    <Button variant="accent" onClick={handleCreateInvite} loading={inviteCreating}>
                      Створити
                    </Button>
                  </>
                ) : (
                  <Button variant="primary" fullWidth onClick={handleCloseInvite}>
                    Готово
                  </Button>
                )}
              </DialogFooter>
            </DialogPanel>
          </Dialog>

          {/* Revoke link confirm */}
          <Dialog open={!!revokeTarget} onClose={() => setRevokeTarget(null)}>
            <DialogPanel maxWidth="sm">
              <DialogHeader>
                <DialogTitle>Відкликати посилання?</DialogTitle>
                <DialogCloseButton onClose={() => setRevokeTarget(null)} />
              </DialogHeader>
              <DialogBody>
                <Alert variant="warning">
                  Посилання стане недійсним. Ті, хто вже вступив через нього, залишаться учасниками.
                </Alert>
              </DialogBody>
              <DialogFooter>
                <Button
                  variant="secondary"
                  onClick={() => setRevokeTarget(null)}
                  disabled={revoking}
                >
                  Скасувати
                </Button>
                <Button variant="danger" onClick={handleRevoke} loading={revoking}>
                  Відкликати
                </Button>
              </DialogFooter>
            </DialogPanel>
          </Dialog>
        </div>
      </div>
    </>
  );
}
