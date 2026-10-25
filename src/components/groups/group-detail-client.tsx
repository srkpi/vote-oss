'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowRightLeft,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Crown,
  IdCard,
  ImagePlus,
  Key,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Upload,
  UserMinus,
  Users,
  Vote,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { PageHeader } from '@/components/common/page-header';
import { ElectionListItem } from '@/components/elections/election-list-item';
import { CampaignsPanel } from '@/components/groups/campaigns-panel';
import { ProtocolsPanel } from '@/components/groups/protocols-panel';
import { RegistrationFormsPanel } from '@/components/groups/registration-forms-panel';
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
import { FilterMultiDropdown, type FilterOption } from '@/components/ui/filters-shell';
import { FormField, Input } from '@/components/ui/form';
import { KyivDateTimePicker } from '@/components/ui/kyiv-date-time-picker';
import { LocalDateTime } from '@/components/ui/local-time';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { StyledSelect } from '@/components/ui/styled-select';
import { UserAvatarMenu } from '@/components/ui/user-avatar-menu';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import {
  AVATAR_MAX_SIZE_BYTES,
  FILE_ALLOWED_IMAGE_MIME_TYPES,
  GROUP_ELECTIONS_PAGE_SIZE,
  GROUP_INVITE_LINK_MAX_DAYS,
  GROUP_INVITE_LINK_MAX_USAGE,
  GROUP_INVITE_LINK_MIN_HOURS,
  GROUP_MEMBER_ROLE_MAX_LENGTH,
  GROUP_NAME_MAX_LENGTH,
  GROUP_REQUISITES_ADDRESS_MAX_LENGTH,
  GROUP_REQUISITES_CONTACT_MAX_LENGTH,
  GROUP_REQUISITES_EMAIL_MAX_LENGTH,
  GROUP_REQUISITES_FULL_NAME_MAX_LENGTH,
} from '@/lib/constants';
import {
  groupRequisitesFormSchema,
  type GroupRequisitesInput,
  type GroupRequisitesOutput,
} from '@/lib/schemas/group-requisites-form';
import { cn } from '@/lib/utils/common';
import type { User } from '@/types/auth';
import type { ElectionCampaign } from '@/types/campaign';
import type { CandidateRegistrationFormAdminSummary } from '@/types/candidate-registration';
import type { ElectionStatus } from '@/types/election';
import type { FileSummary } from '@/types/file';
import type { GroupDetail, GroupInviteLink, GroupMemberSummary } from '@/types/group';
import type { ProtocolSummary } from '@/types/protocol';

const ELECTION_STATUS_LABELS: Record<ElectionStatus, string> = {
  open: 'Активні',
  upcoming: 'Заплановані',
  closed: 'Завершені',
};

const ELECTION_STATUS_ORDER: ElectionStatus[] = ['open', 'upcoming', 'closed'];

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
        <p className="font-body mb-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Посилання для вступу
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 overflow-hidden rounded border bg-surface p-2.5">
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
        <p className="font-body mb-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Токен
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 overflow-hidden rounded border bg-surface p-2.5">
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
  // oxlint-disable-next-line react/purity -- Re-evaluate link expiration when the card renders.
  const isExpired = new Date(link.expiresAt) < new Date();
  const isExhausted = link.currentUsage >= link.maxUsage;
  const isRevoked = !!link.deletedAt;
  const isInactive = isExpired || isExhausted || isRevoked;

  return (
    <div
      className={cn(
        'border-border-color overflow-hidden rounded-xl border bg-card',
        isInactive && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0 flex-1 space-y-1">
          {link.label && (
            <p className="font-body text-sm font-medium text-foreground">{link.label}</p>
          )}
          <p className="font-body text-xs text-muted-foreground">
            Використань: {link.currentUsage} / {link.maxUsage}
          </p>
          <p className="font-body text-xs text-muted-foreground">
            Дійсне до: <LocalDateTime date={link.expiresAt} />
          </p>
          {isRevoked && (
            <p className="font-body text-xs text-error">
              Відкликано: <LocalDateTime date={link.deletedAt!} />
            </p>
          )}
          {isExpired && !isRevoked && (
            <p className="font-body text-xs text-muted-foreground">Термін дії минув</p>
          )}
          {isExhausted && !isRevoked && (
            <p className="font-body text-xs text-muted-foreground">Ліміт використань вичерпано</p>
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
        <div className="border-t border-border-subtle p-4">
          <p className="font-body mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Хто вступив
          </p>
          <div className="space-y-1.5">
            {link.usages.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-2">
                <p className="font-mono text-xs text-foreground">{u.userId}</p>
                <p className="font-body text-xs text-muted-foreground">
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
// Requisite row (sidebar list item)
// ────────────────────────────────────────────────────────────────────────────

function RequisiteRow({
  icon,
  label,
  value,
  fallback,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  fallback?: string;
}) {
  const display = value || fallback || null;
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 shrink-0 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="font-body text-xs text-muted-foreground">{label}</p>
        {display ? (
          <p className="font-body text-sm wrap-break-word text-foreground">
            {display}
            {!value && fallback && (
              <span className="text-xs text-muted-foreground"> (з назви групи)</span>
            )}
          </p>
        ) : (
          <p className="font-body text-sm text-muted-foreground italic">—</p>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

interface GroupDetailClientProps {
  group: GroupDetail;
  session: User;
  registrationForms: CandidateRegistrationFormAdminSummary[];
  registrationFormsError: string | null;
  protocols: ProtocolSummary[];
  protocolsError: string | null;
  campaigns: ElectionCampaign[];
  campaignsError: string | null;
}

export function GroupDetailClient({
  group: initialGroup,
  session,
  registrationForms,
  registrationFormsError,
  protocols,
  protocolsError,
  campaigns,
  campaignsError,
}: GroupDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [group, setGroup] = useState<GroupDetail>(initialGroup);

  const isOwner = group.ownerId === session.userId;
  const isAdminWithManageGroups = session.isAdmin && session.manageGroups;
  const canManage = isOwner || isAdminWithManageGroups;
  // Admins who own the group (or have manage_groups) may create elections
  // pre-restricted to this group's membership.
  const canCreateElection = session.isAdmin && canManage;
  // ВКСУ-tab visibility: only active members of a VKSU-typed group can manage
  // candidate registration forms.
  const isActiveMember = isOwner || group.members.some((m) => m.userId === session.userId);
  const canManageRegistrationForms = group.type === 'VKSU' && isActiveMember;

  // ── Elections filter / pagination ─────────────────────────────────────────
  const [electionSearch, setElectionSearch] = useState('');
  const [electionStatuses, setElectionStatuses] = useState<string[]>([]);
  const [electionPage, setElectionPage] = useState(1);

  const filteredElections = (() => {
    const q = electionSearch.trim().toLowerCase();
    return group.elections.filter((e) => {
      if (electionStatuses.length > 0 && !electionStatuses.includes(e.status)) {
        return false;
      }
      if (q) {
        const inTitle = e.title.toLowerCase().includes(q);
        const inAuthor = e.createdBy.fullName.toLowerCase().includes(q);
        if (!inTitle && !inAuthor) {
          return false;
        }
      }
      return true;
    });
  })();

  const electionStatusOptions: FilterOption[] = (() => {
    const q = electionSearch.trim().toLowerCase();
    const counts: Record<ElectionStatus, number> = { open: 0, upcoming: 0, closed: 0 };
    for (const e of group.elections) {
      if (q) {
        const inTitle = e.title.toLowerCase().includes(q);
        const inAuthor = e.createdBy.fullName.toLowerCase().includes(q);
        if (!inTitle && !inAuthor) {
          continue;
        }
      }
      counts[e.status] = (counts[e.status] ?? 0) + 1;
    }
    return ELECTION_STATUS_ORDER.map((s) => ({
      value: s,
      label: ELECTION_STATUS_LABELS[s],
      count: counts[s],
    }));
  })();

  const electionTotalPages = Math.max(
    1,
    Math.ceil(filteredElections.length / GROUP_ELECTIONS_PAGE_SIZE),
  );
  const safeElectionPage = Math.min(electionPage, electionTotalPages);
  const pagedElections = filteredElections.slice(
    (safeElectionPage - 1) * GROUP_ELECTIONS_PAGE_SIZE,
    safeElectionPage * GROUP_ELECTIONS_PAGE_SIZE,
  );

  const handleElectionSearchChange = (value: string) => {
    setElectionSearch(value);
    setElectionPage(1);
  };

  const handleElectionStatusesChange = (values: string[]) => {
    setElectionStatuses(values);
    setElectionPage(1);
  };

  const hasElectionFilters = electionStatuses.length > 0 || electionSearch.trim().length > 0;

  // ── Rename ────────────────────────────────────────────────────────────────
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState(group.name);
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const handleRename = async () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === group.name) {
      return;
    }
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

  // ── Edit member role ──────────────────────────────────────────────────────
  const [roleTarget, setRoleTarget] = useState<GroupMemberSummary | null>(null);
  const [roleDraft, setRoleDraft] = useState('');
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  const openRoleEditor = (member: GroupMemberSummary) => {
    setRoleTarget(member);
    setRoleDraft(member.role ?? '');
    setRoleError(null);
  };

  const closeRoleEditor = () => {
    setRoleTarget(null);
    setRoleDraft('');
    setRoleError(null);
  };

  const handleRoleSave = async () => {
    if (!roleTarget) {
      return;
    }
    setRoleSaving(true);
    setRoleError(null);
    const trimmed = roleDraft.trim();
    const result = await api.groups.members.updateRole(
      group.id,
      roleTarget.userId,
      trimmed.length === 0 ? null : trimmed,
    );
    if (result.success) {
      const newRole = trimmed.length === 0 ? null : trimmed;
      setGroup((prev) => ({
        ...prev,
        members: prev.members.map((m) =>
          m.userId === roleTarget.userId ? { ...m, role: newRole } : m,
        ),
      }));
      toast({ title: 'Роль оновлено', variant: 'success' });
      closeRoleEditor();
    } else {
      setRoleError(result.error);
    }
    setRoleSaving(false);
  };

  // ── Kick / leave ──────────────────────────────────────────────────────────
  const [kickTarget, setKickTarget] = useState<GroupMemberSummary | null>(null);
  const [kicking, setKicking] = useState(false);
  const isSelfLeave = kickTarget?.userId === session.userId;

  const handleKickConfirm = async () => {
    if (!kickTarget) {
      return;
    }
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
    if (!selectedNewOwner) {
      return;
    }
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

  // ── Invite links — list modal + create modal ──────────────────────────────
  const [invitesViewOpen, setInvitesViewOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLabel, setInviteLabel] = useState('');
  const [inviteMaxUsage, setInviteMaxUsage] = useState(10);
  const [inviteCreating, setInviteCreating] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  // oxlint-disable-next-line react/purity -- Keep invite date bounds relative to the current render time.
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
      // oxlint-disable-next-line typescript/no-unused-vars
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

  // ── Edit requisites ───────────────────────────────────────────────────────
  const [requisitesOpen, setRequisitesOpen] = useState(false);
  const requisitesForm = useForm<GroupRequisitesInput, unknown, GroupRequisitesOutput>({
    resolver: zodResolver(groupRequisitesFormSchema),
    defaultValues: { fullName: '', address: '', email: '', contact: '' },
  });
  const {
    errors: requisitesErrors,
    isSubmitting: requisitesSaving,
    isDirty: requisitesDirty,
  } = requisitesForm.formState;
  const requisitesError = requisitesErrors.root?.message;
  const openRequisites = () => {
    requisitesForm.reset({
      fullName: group.requisites.fullName ?? '',
      address: group.requisites.address ?? '',
      email: group.requisites.email ?? '',
      contact: group.requisites.contact ?? '',
    });
    setRequisitesOpen(true);
  };
  const handleRequisitesSave = requisitesForm.handleSubmit(async (values) => {
    const result = await api.groups.updateRequisites(group.id, values);
    if (result.success) {
      setGroup((prev) => ({ ...prev, requisites: { ...prev.requisites, ...values } }));
      requisitesForm.reset(requisitesForm.getValues());
      toast({ title: 'Реквізити оновлено', variant: 'success' });
      setRequisitesOpen(false);
    } else {
      requisitesForm.setError('root', { message: result.error });
    }
  });

  // ── Logo upload / remove ─────────────────────────────────────────────────
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  const setLogo = (logo: FileSummary | null) => {
    setGroup((prev) => ({
      ...prev,
      requisites: { ...prev.requisites, logo },
    }));
  };

  const handleLogoFileSelected = async (file: File) => {
    if (
      !FILE_ALLOWED_IMAGE_MIME_TYPES.includes(
        file.type as (typeof FILE_ALLOWED_IMAGE_MIME_TYPES)[number],
      )
    ) {
      toast({
        title: 'Непідтримуваний формат',
        description: 'Дозволені PNG, JPEG, WebP',
        variant: 'error',
      });
      return;
    }
    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      toast({
        title: 'Файл завеликий',
        description: `Максимум ${Math.floor(AVATAR_MAX_SIZE_BYTES / (1024 * 1024))} МБ`,
        variant: 'error',
      });
      return;
    }
    setLogoUploading(true);
    const result = await api.groups.avatar.set(group.id, file);
    if (!result.success) {
      toast({ title: 'Не вдалось завантажити', description: result.error, variant: 'error' });
      setLogoUploading(false);
      return;
    }
    setLogo(result.data);
    toast({ title: 'Логотип оновлено', variant: 'success' });
    setLogoUploading(false);
  };

  const handleLogoRemove = async () => {
    if (!group.requisites.logo) {
      return;
    }
    setLogoUploading(true);
    const result = await api.groups.avatar.remove(group.id);
    if (!result.success) {
      toast({ title: 'Не вдалось видалити', description: result.error, variant: 'error' });
      setLogoUploading(false);
      return;
    }
    setLogo(null);
    toast({ title: 'Логотип видалено', variant: 'success' });
    setLogoUploading(false);
  };

  const hasRequisites =
    !!group.requisites.fullName ||
    !!group.requisites.address ||
    !!group.requisites.email ||
    !!group.requisites.contact;

  // ── Revoke invite link ────────────────────────────────────────────────────
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const handleRevoke = async () => {
    if (!revokeTarget) {
      return;
    }
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            {/* Elections panel */}
            <div className="border-border-color rounded-xl border bg-card shadow-card">
              <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
                <div className="flex items-center gap-2">
                  <Vote className="h-4 w-4 text-kpi-gray-mid" />
                  <h2 className="font-display text-base font-semibold text-foreground">
                    Голосування
                  </h2>
                </div>
                {canCreateElection ? (
                  <Button variant="accent" size="sm" asChild>
                    <Link href={`/admin/elections/new?groupId=${group.id}`}>
                      <Plus className="h-3.5 w-3.5" />
                      <span className="fony-body text-sm">Нове</span>
                    </Link>
                  </Button>
                ) : (
                  <span className="font-body text-sm text-muted-foreground">
                    {group.elections.length}
                  </span>
                )}
              </div>

              {group.elections.length === 0 ? (
                <p className="font-body px-5 py-8 text-center text-sm text-muted-foreground">
                  Для цієї групи ще немає голосувань
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle px-5 py-3">
                    <FilterMultiDropdown
                      label="Статус"
                      options={electionStatusOptions}
                      value={electionStatuses}
                      onChange={handleElectionStatusesChange}
                    />
                    <div className="min-w-40 flex-1">
                      <SearchInput
                        value={electionSearch}
                        onChange={handleElectionSearchChange}
                        placeholder="Пошук голосувань…"
                      />
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-b-xl">
                    {pagedElections.length === 0 ? (
                      <p className="font-body px-5 py-8 text-center text-sm text-muted-foreground">
                        {hasElectionFilters
                          ? 'За заданими критеріями нічого не знайдено'
                          : 'Для цієї групи ще немає голосувань'}
                      </p>
                    ) : (
                      <div className="divide-y divide-border-subtle">
                        {pagedElections.map((election, i) => (
                          <ElectionListItem
                            key={election.id}
                            election={election}
                            index={(safeElectionPage - 1) * GROUP_ELECTIONS_PAGE_SIZE + i}
                          />
                        ))}
                      </div>
                    )}

                    {electionTotalPages > 1 && (
                      <div className="border-t border-border-subtle px-5 py-3">
                        <Pagination
                          page={safeElectionPage}
                          totalPages={electionTotalPages}
                          setPage={setElectionPage}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {canManageRegistrationForms && (
              <RegistrationFormsPanel
                groupId={group.id}
                initialForms={registrationForms}
                initialLoadError={registrationFormsError}
              />
            )}

            {canManageRegistrationForms && (
              <CampaignsPanel
                groupId={group.id}
                initialCampaigns={campaigns}
                initialLoadError={campaignsError}
              />
            )}

            {(isActiveMember || isAdminWithManageGroups || protocols.length > 0) && (
              <ProtocolsPanel
                groupId={group.id}
                canManage={isOwner}
                initialProtocols={protocols}
                initialLoadError={protocolsError}
              />
            )}
          </div>

          {/* Sidebar: group info + members + actions */}
          <div className="space-y-4 lg:col-span-2">
            {/* Public logo (visible to everyone when set) */}
            {!isOwner && group.requisites.logo && (
              <div className="border-border-color overflow-hidden rounded-xl border bg-card p-4 shadow-card">
                <div className="flex items-center justify-center">
                  {/* oxlint-disable-next-line nextjs/no-img-element */}
                  <img
                    src={group.requisites.logo.url}
                    alt={`Логотип ${group.name}`}
                    className="max-h-32 w-auto object-contain"
                  />
                </div>
              </div>
            )}

            {/* Members panel — moved into sidebar above management */}
            <div className="border-border-color overflow-hidden rounded-xl border bg-card shadow-card">
              <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-kpi-gray-mid" />
                  <h2 className="font-display text-base font-semibold text-foreground">Учасники</h2>
                </div>
                <span className="font-body text-sm text-muted-foreground">{group.memberCount}</span>
              </div>

              <div className="divide-y divide-border-subtle">
                {group.members.map((member) => {
                  const isSelf = member.userId === session.userId;
                  const canKick = !isSelf && canManage && !member.isOwner;
                  const canLeave = isSelf && !isOwner;

                  return (
                    <div key={member.userId} className="flex items-center gap-3 px-5 py-3.5">
                      <UserAvatarMenu
                        userId={member.userId}
                        fullName={member.displayName ?? member.userId}
                        avatarUrl={member.avatarUrl}
                        size={36}
                        canDelete={session.isAdmin}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-body truncate text-sm font-medium text-foreground">
                            {member.displayName}
                          </p>
                          {member.isOwner && (
                            <Crown className="h-3.5 w-3.5 shrink-0 text-kpi-orange" />
                          )}
                          {isSelf && (
                            <span className="font-body text-xs text-muted-foreground">(ви)</span>
                          )}
                        </div>
                        {member.role ? (
                          <p className="font-body text-xs text-kpi-navy">{member.role}</p>
                        ) : null}
                        <p className="font-body text-xs text-muted-foreground">
                          З <LocalDateTime date={member.joinedAt} />
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {isOwner && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => openRoleEditor(member)}
                            className="text-muted-foreground"
                            title="Редагувати роль"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
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
                            className="text-muted-foreground hover:bg-error-bg hover:text-error"
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

            {/* Requisites */}
            {isOwner && (
              <div className="border-border-color overflow-hidden rounded-xl border bg-card shadow-card">
                <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
                  <div className="flex items-center gap-2">
                    <IdCard className="h-4 w-4 text-kpi-gray-mid" />
                    <h3 className="font-display text-base font-semibold text-foreground">
                      Реквізити
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={openRequisites}
                    className="text-muted-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Logo editor — separate row, persists immediately on change */}
                <div className="border-b border-border-subtle px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0 text-muted-foreground">
                      <ImagePlus className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-xs text-muted-foreground">Логотип</p>
                      {group.requisites.logo ? (
                        <div className="mt-2 flex items-center gap-3">
                          {/* oxlint-disable-next-line nextjs/no-img-element */}
                          <img
                            src={group.requisites.logo.url}
                            alt="Логотип"
                            className="h-16 w-16 rounded border border-border-subtle bg-white object-contain"
                          />
                          <div className="flex flex-col gap-1.5">
                            <Button
                              variant="secondary"
                              size="xs"
                              onClick={() => logoInputRef.current?.click()}
                              loading={logoUploading}
                              icon={<Upload className="h-3 w-3" />}
                            >
                              Замінити
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={handleLogoRemove}
                              disabled={logoUploading}
                              className="text-error hover:bg-error-bg"
                              icon={<Trash2 className="h-3 w-3" />}
                            >
                              Видалити
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => logoInputRef.current?.click()}
                            loading={logoUploading}
                            icon={<Upload className="h-3.5 w-3.5" />}
                          >
                            Завантажити
                          </Button>
                          <p className="font-body mt-1.5 text-xs text-muted-foreground">
                            PNG, JPEG, WebP — до {Math.floor(AVATAR_MAX_SIZE_BYTES / 1024)} КБ
                          </p>
                        </div>
                      )}
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept={FILE_ALLOWED_IMAGE_MIME_TYPES.join(',')}
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (f) {
                            void handleLogoFileSelected(f);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 px-5 py-4">
                  {hasRequisites ? (
                    <>
                      <RequisiteRow
                        icon={<Building2 className="h-3.5 w-3.5" />}
                        label="Повна назва"
                        value={group.requisites.fullName}
                        fallback={group.name}
                      />
                      <RequisiteRow
                        icon={<MapPin className="h-3.5 w-3.5" />}
                        label="Адреса"
                        value={group.requisites.address}
                      />
                      <RequisiteRow
                        icon={<Mail className="h-3.5 w-3.5" />}
                        label="Ел. пошта"
                        value={group.requisites.email}
                      />
                      <RequisiteRow
                        icon={<Phone className="h-3.5 w-3.5" />}
                        label="Контакт"
                        value={group.requisites.contact}
                      />
                    </>
                  ) : (
                    <p className="font-body text-sm text-muted-foreground">
                      Реквізити не заповнені. Вони використовуються для автоматичного формування
                      протоколів.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Owner actions */}
            {isOwner && (
              <div className="border-border-color space-y-3 overflow-hidden rounded-xl border bg-card p-5 shadow-card">
                <h3 className="font-display text-base font-semibold text-foreground">Керування</h3>

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

                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => setInvitesViewOpen(true)}
                  icon={<Key className="h-3.5 w-3.5" />}
                >
                  Переглянути запрошення
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
              <div className="border-border-color space-y-3 overflow-hidden rounded-xl border bg-card p-5 shadow-card">
                <h3 className="font-display text-base font-semibold text-foreground">
                  Адмін-керування
                </h3>
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => setInvitesViewOpen(true)}
                  icon={<Key className="h-3.5 w-3.5" />}
                >
                  Переглянути запрошення
                </Button>
                {group.isMember && (
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    onClick={() => setTransferOpen(true)}
                    icon={<Crown className="h-3.5 w-3.5" />}
                  >
                    Взяти право власника
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

          {/* Edit member role */}
          <Dialog open={!!roleTarget} onClose={() => !roleSaving && closeRoleEditor()}>
            <DialogPanel maxWidth="sm">
              <DialogHeader>
                <DialogTitle>Роль учасника</DialogTitle>
                <DialogCloseButton onClose={closeRoleEditor} />
              </DialogHeader>
              <DialogBody className="space-y-3">
                {roleError && (
                  <Alert variant="error" onDismiss={() => setRoleError(null)}>
                    {roleError}
                  </Alert>
                )}
                <p className="font-body text-sm text-muted-foreground">
                  <strong>{roleTarget?.displayName}</strong>
                </p>
                <p className="font-body text-sm text-muted-foreground">
                  Роль використовується у протоколах (наприклад, у листі присутності або серед
                  відповідальних). Залиште пустим, щоб очистити.
                </p>
                <FormField htmlFor="member-role">
                  <Input
                    id="member-role"
                    value={roleDraft}
                    onChange={(e) => setRoleDraft(e.target.value)}
                    maxLength={GROUP_MEMBER_ROLE_MAX_LENGTH}
                    placeholder="Голова, Секретар, Член комісії…"
                    autoFocus
                  />
                </FormField>
              </DialogBody>
              <DialogFooter>
                <Button variant="secondary" onClick={closeRoleEditor} disabled={roleSaving}>
                  Скасувати
                </Button>
                <Button variant="primary" onClick={handleRoleSave} loading={roleSaving}>
                  Зберегти
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
                    <label className="font-body block text-sm font-medium text-foreground">
                      Новий власник <span className="text-error">*</span>
                    </label>
                    <StyledSelect
                      value={selectedNewOwner}
                      onChange={setSelectedNewOwner}
                      placeholder="Оберіть учасника…"
                      options={transferCandidates.map((m) => ({
                        value: m.userId,
                        label: m.displayName,
                      }))}
                    />
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

          {/* View invite links */}
          <Dialog open={invitesViewOpen} onClose={() => setInvitesViewOpen(false)}>
            <DialogPanel maxWidth="md">
              <DialogHeader>
                <DialogTitle>Запрошення</DialogTitle>
                <DialogCloseButton onClose={() => setInvitesViewOpen(false)} />
              </DialogHeader>
              <DialogBody className="space-y-4">
                {group.inviteLinks.length === 0 ? (
                  <p className="font-body py-4 text-center text-sm text-muted-foreground">
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
              </DialogBody>
              <DialogFooter>
                <Button
                  variant="accent"
                  fullWidth
                  onClick={() => setInviteOpen(true)}
                  icon={<Plus className="h-3.5 w-3.5" />}
                >
                  Нове посилання
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

          {/* Edit requisites */}
          <Dialog
            open={requisitesOpen}
            onClose={() => !requisitesSaving && setRequisitesOpen(false)}
          >
            <DialogPanel maxWidth="md">
              <DialogHeader>
                <DialogTitle>Реквізити групи</DialogTitle>
                <DialogCloseButton onClose={() => setRequisitesOpen(false)} />
              </DialogHeader>
              <DialogBody className="space-y-4">
                {requisitesError && (
                  <Alert variant="error" onDismiss={() => requisitesForm.clearErrors('root')}>
                    {requisitesError}
                  </Alert>
                )}
                <p className="font-body text-sm text-muted-foreground">
                  Використовуються для автоматичного формування протоколів. Якщо повна назва не
                  задана — у протокол потрапить назва групи.
                </p>
                <FormField
                  label="Повна назва (необов'язково)"
                  htmlFor="req-full-name"
                  error={requisitesErrors.fullName?.message}
                >
                  <Input
                    id="req-full-name"
                    {...requisitesForm.register('fullName')}
                    error={!!requisitesErrors.fullName}
                    maxLength={GROUP_REQUISITES_FULL_NAME_MAX_LENGTH}
                    placeholder={group.name}
                  />
                </FormField>
                <FormField
                  label="Адреса"
                  htmlFor="req-address"
                  error={requisitesErrors.address?.message}
                >
                  <Input
                    id="req-address"
                    {...requisitesForm.register('address')}
                    error={!!requisitesErrors.address}
                    maxLength={GROUP_REQUISITES_ADDRESS_MAX_LENGTH}
                    placeholder="Корпус, кімната"
                  />
                </FormField>
                <FormField
                  label="Електронна пошта"
                  htmlFor="req-email"
                  error={requisitesErrors.email?.message}
                >
                  <Input
                    id="req-email"
                    type="email"
                    {...requisitesForm.register('email')}
                    error={!!requisitesErrors.email}
                    maxLength={GROUP_REQUISITES_EMAIL_MAX_LENGTH}
                    placeholder="oss@example.com"
                  />
                </FormField>
                <FormField
                  label="Контакт"
                  htmlFor="req-contact"
                  error={requisitesErrors.contact?.message}
                >
                  <Input
                    id="req-contact"
                    {...requisitesForm.register('contact')}
                    error={!!requisitesErrors.contact}
                    maxLength={GROUP_REQUISITES_CONTACT_MAX_LENGTH}
                    placeholder="Телефон або @telegram"
                  />
                </FormField>
              </DialogBody>
              <DialogFooter>
                <Button
                  variant="secondary"
                  onClick={() => setRequisitesOpen(false)}
                  disabled={requisitesSaving}
                >
                  Скасувати
                </Button>
                <Button
                  variant="primary"
                  onClick={handleRequisitesSave}
                  loading={requisitesSaving}
                  disabled={!requisitesDirty}
                >
                  Зберегти
                </Button>
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
