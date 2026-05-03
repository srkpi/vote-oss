import type { Admin, InviteToken, InviteTokenRequest, InviteTokenResponse } from '@/types/admin';
import type { ApiResult } from '@/types/api';
import type { DiiaInitResponse } from '@/types/auth';
import type { BallotsResponse, PetitionSignatoriesResponse } from '@/types/ballot';
import type {
  CreateElectionBypassTokenRequest,
  CreateGlobalBypassTokenRequest,
  ElectionBypassToken,
  GlobalBypassToken,
} from '@/types/bypass';
import type {
  CandidateRegistration,
  CandidateRegistrationForm,
  CandidateRegistrationFormAdminSummary,
  CandidateRegistrationFormDetail,
  CandidateRegistrationFormSummary,
  CreateCandidateRegistrationFormRequest,
  RegenerateTeamInviteResponse,
  TeamInvitePreview,
  TeamSlot,
  UpdateCandidateRegistrationFormRequest,
  UpsertCandidateRegistrationDraftRequest,
} from '@/types/candidate-registration';
import type {
  CreateElectionRequest,
  CreateElectionResponse,
  ElectionDetail,
  ElectionsListResponse,
} from '@/types/election';
import type {
  FaqCategoryCreated,
  FaqCategoryData,
  FaqCategoryUpdated,
  FaqItemCreated,
  FaqItemUpdated,
} from '@/types/faq';
import type { FileSummary } from '@/types/file';
import type {
  AdminGroupSummary,
  CreateInviteLinkRequest,
  Group,
  GroupDetail,
  GroupInviteLink,
  GroupOption,
  GroupType,
  JoinGroupResponse,
  UpdateGroupRequisitesPatch,
} from '@/types/group';
import type {
  CreateProtocolRequest,
  Protocol,
  ProtocolComputedCounts,
  ProtocolSummary,
  UpdateProtocolRequest,
} from '@/types/protocol';
import type { VoteToken } from '@/types/vote';

export interface ProtocolAgendaVoteTotals {
  yes_count: number;
  no_count: number;
  not_decided_count: number;
}

export type ProtocolWithCounts = Protocol & {
  counts: ProtocolComputedCounts;
  agendaVoteTotals: Record<string, ProtocolAgendaVoteTotals | null>;
  isOwner: boolean;
};

export interface ProtocolsListWithNextNumber {
  protocols: ProtocolSummary[];
  nextNumber: number;
  year: number;
}

type Fetcher = <T>(path: string, options?: RequestInit) => Promise<ApiResult<T>>;

export function createApiClient(fetcher: Fetcher) {
  return {
    auth: {
      loginWithTicket: (ticketId: string) =>
        fetcher<{ redirectTo: string }>('/auth/kpi-id', {
          method: 'POST',
          body: JSON.stringify({ ticketId }),
        }),
      diiaInit: () => fetcher<DiiaInitResponse>('/auth/diia/init', { method: 'POST' }),
      diiaCheck: (requestId: string) =>
        fetcher<{ status: 'success' | 'processing'; redirectTo?: string }>('/auth/diia/check', {
          method: 'POST',
          body: JSON.stringify({ requestId }),
        }),
      refresh: () => fetcher<void>('/auth/refresh', { method: 'POST' }),
      logout: () => fetcher<void>('/auth/logout', { method: 'POST' }),
    },

    elections: {
      list: (params?: { type?: 'ELECTION' | 'PETITION'; sort?: 'createdAt' | 'votes' }) => {
        const search = new URLSearchParams();
        if (params?.type) search.set('type', params.type);
        if (params?.sort) search.set('sort', params.sort);
        const qs = search.toString();
        return fetcher<ElectionsListResponse>(`/elections${qs ? `?${qs}` : ''}`);
      },
      get: (id: string) => fetcher<ElectionDetail>(`/elections/${id}`),
      og: (id: string) => fetcher<{ title: string }>(`/elections/${id}/og`),
      create: (data: CreateElectionRequest) =>
        fetcher<CreateElectionResponse>('/elections', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      delete: (id: string) => fetcher<void>(`/elections/${id}`, { method: 'DELETE' }),
      restore: (id: string) => fetcher<void>(`/elections/${id}/restore`, { method: 'POST' }),
      approve: (id: string) =>
        fetcher<{ id: string; approved: true; approvedAt: string; closesAt: string }>(
          `/elections/${id}/approve`,
          { method: 'POST' },
        ),

      getVoteToken: (electionId: string) =>
        fetcher<VoteToken>(`/elections/${electionId}/token`, { method: 'POST' }),
      submitBallot: (
        electionId: string,
        data: { token: string; signature: string; encryptedBallot: string; nullifier: string },
      ) =>
        fetcher<{ ballotHash: string }>(`/elections/${electionId}/ballot`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      getBallots: (electionId: string) =>
        fetcher<BallotsResponse>(`/elections/${electionId}/ballots`),
      getSignatories: (electionId: string) =>
        fetcher<PetitionSignatoriesResponse>(`/elections/${electionId}/signatories`),
      getVoters: (electionId: string) =>
        fetcher<{ voters: { userId: string; fullName: string }[] }>(
          `/elections/${electionId}/voters`,
        ),

      bypass: {
        list: (electionId: string) =>
          fetcher<ElectionBypassToken[]>(`/elections/${electionId}/bypass`),
        create: (electionId: string, data: CreateElectionBypassTokenRequest) =>
          fetcher<{
            token: string;
            tokenHash: string;
            electionId: string;
            bypassRestrictions: string[];
            maxUsage: number;
            currentUsage: number;
            deletedAt: null;
            canDelete: boolean;
            canRevokeUsages: boolean;
          }>(`/elections/${electionId}/bypass`, { method: 'POST', body: JSON.stringify(data) }),
      },
    },

    admins: {
      list: () => fetcher<Admin[]>('/admins'),
      delete: (userId: string) => fetcher<void>(`/admins/${userId}`, { method: 'DELETE' }),
      patch: (
        userId: string,
        data: {
          manageAdmins?: boolean;
          manageGroups?: boolean;
          managePetitions?: boolean;
          manageFaq?: boolean;
          restrictedToFaculty?: boolean;
        },
      ) =>
        fetcher<void>(`/admins/${userId}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        }),
      leave: (replacementId: string | null) =>
        fetcher<void>('/admins/leave', {
          method: 'POST',
          body: JSON.stringify({ replacementId }),
        }),
      invites: {
        list: () => fetcher<InviteToken[]>('/admins/invite'),
        create: (data: InviteTokenRequest) =>
          fetcher<InviteTokenResponse>('/admins/invite', {
            method: 'POST',
            body: JSON.stringify(data),
          }),
        delete: (tokenHash: string) =>
          fetcher<void>(`/admins/invite/${tokenHash}`, { method: 'DELETE' }),
      },
      join: (token: string) =>
        fetcher<void>('/admins/join', { method: 'POST', body: JSON.stringify({ token }) }),
    },

    campus: {
      getGroups: () => fetcher<Record<string, string[]>>('/campus/groups'),
    },

    bypass: {
      apply: (token: string) =>
        fetcher<{ type: 'GLOBAL' | 'ELECTION'; electionId: string | null }>('/bypass/apply', {
          method: 'POST',
          body: JSON.stringify({ token }),
        }),

      listGlobal: () => fetcher<GlobalBypassToken[]>('/bypass'),
      createGlobal: (data: CreateGlobalBypassTokenRequest) =>
        fetcher<{
          token: string;
          tokenHash: string;
          bypassNotStudying: boolean;
          bypassGraduate: boolean;
          maxUsage: number;
          validUntil: string;
          deletedAt: null;
          canDelete: boolean;
          canRevokeUsages: boolean;
        }>('/bypass', { method: 'POST', body: JSON.stringify(data) }),

      deleteGlobal: (tokenHash: string) =>
        fetcher<void>(`/bypass/global/${tokenHash}`, { method: 'DELETE' }),
      deleteElection: (tokenHash: string) =>
        fetcher<void>(`/bypass/election/${tokenHash}`, { method: 'DELETE' }),

      revokeGlobalUsage: (tokenHash: string, userId: string) =>
        fetcher<void>(`/bypass/global/${tokenHash}/usages/${userId}`, { method: 'DELETE' }),
      revokeElectionUsage: (tokenHash: string, userId: string) =>
        fetcher<void>(`/bypass/election/${tokenHash}/usages/${userId}`, { method: 'DELETE' }),
    },

    faq: {
      get: () => fetcher<FaqCategoryData[]>('/faq'),
      categories: {
        create: (title: string) =>
          fetcher<FaqCategoryCreated>('/faq', {
            method: 'POST',
            body: JSON.stringify({ title }),
          }),
        update: (id: string, title: string) =>
          fetcher<FaqCategoryUpdated>(`/faq/categories/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ title }),
          }),
        delete: (id: string) => fetcher<void>(`/faq/categories/${id}`, { method: 'DELETE' }),
        reorder: (order: string[]) =>
          fetcher<void>('/faq/categories/reorder', {
            method: 'PATCH',
            body: JSON.stringify({ order }),
          }),
      },
      items: {
        create: (categoryId: string, title: string, content: string) =>
          fetcher<FaqItemCreated>(`/faq/categories/${categoryId}/items`, {
            method: 'POST',
            body: JSON.stringify({ title, content }),
          }),
        update: (id: string, title: string, content: string) =>
          fetcher<FaqItemUpdated>(`/faq/items/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ title, content }),
          }),
        delete: (id: string) => fetcher<void>(`/faq/items/${id}`, { method: 'DELETE' }),
        reorder: (categoryId: string, order: string[]) =>
          fetcher<void>(`/faq/categories/${categoryId}/items/reorder`, {
            method: 'PATCH',
            body: JSON.stringify({ order }),
          }),
      },
    },

    groups: {
      list: () => fetcher<Group[]>('/groups'),
      get: (id: string) => fetcher<GroupDetail>(`/groups/${id}`),
      og: (id: string) => fetcher<{ name: string }>(`/groups/${id}/og`),

      create: (name: string) =>
        fetcher<Group>('/groups', { method: 'POST', body: JSON.stringify({ name }) }),
      rename: (id: string, name: string) =>
        fetcher<void>(`/groups/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
      setType: (id: string, type: GroupType) =>
        fetcher<void>(`/groups/${id}`, { method: 'PATCH', body: JSON.stringify({ type }) }),
      updateRequisites: (id: string, requisites: UpdateGroupRequisitesPatch) =>
        fetcher<void>(`/groups/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ requisites }),
        }),
      delete: (id: string) => fetcher<void>(`/groups/${id}`, { method: 'DELETE' }),

      join: (token: string) =>
        fetcher<JoinGroupResponse>('/groups/join', {
          method: 'POST',
          body: JSON.stringify({ token }),
        }),

      transfer: (id: string, newOwnerId: string) =>
        fetcher<void>(`/groups/${id}/transfer`, {
          method: 'POST',
          body: JSON.stringify({ newOwnerId }),
        }),

      members: {
        remove: (groupId: string, userId: string) =>
          fetcher<void>(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
        updateRole: (groupId: string, userId: string, role: string | null) =>
          fetcher<void>(`/groups/${groupId}/members/${userId}`, {
            method: 'PATCH',
            body: JSON.stringify({ role }),
          }),
      },

      inviteLinks: {
        list: (groupId: string) => fetcher<GroupInviteLink[]>(`/groups/${groupId}/invite-links`),
        create: (groupId: string, data: CreateInviteLinkRequest) =>
          fetcher<GroupInviteLink & { token: string }>(`/groups/${groupId}/invite-links`, {
            method: 'POST',
            body: JSON.stringify(data),
          }),
        revoke: (groupId: string, linkId: string) =>
          fetcher<void>(`/groups/${groupId}/invite-links/${linkId}`, { method: 'DELETE' }),
      },

      owned: () => fetcher<GroupOption[]>('/groups/owned'),
      all: () => fetcher<AdminGroupSummary[]>('/groups/all'),

      registrationForms: {
        list: (groupId: string) =>
          fetcher<CandidateRegistrationFormAdminSummary[]>(`/groups/${groupId}/registration-forms`),
        create: (groupId: string, data: CreateCandidateRegistrationFormRequest) =>
          fetcher<CandidateRegistrationFormAdminSummary>(`/groups/${groupId}/registration-forms`, {
            method: 'POST',
            body: JSON.stringify(data),
          }),
      },

      protocols: {
        list: (groupId: string) => fetcher<ProtocolSummary[]>(`/groups/${groupId}/protocols`),
        listWithNextNumber: (groupId: string, year: number) =>
          fetcher<ProtocolsListWithNextNumber>(
            `/groups/${groupId}/protocols?nextNumberForYear=${year}`,
          ),
        create: (groupId: string, data: CreateProtocolRequest) =>
          fetcher<Protocol>(`/groups/${groupId}/protocols`, {
            method: 'POST',
            body: JSON.stringify(data),
          }),
      },
    },

    protocols: {
      get: (id: string) => fetcher<ProtocolWithCounts>(`/protocols/${id}`),
      update: (id: string, data: UpdateProtocolRequest) =>
        fetcher<ProtocolWithCounts>(`/protocols/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      delete: (id: string) => fetcher<void>(`/protocols/${id}`, { method: 'DELETE' }),
    },

    registrationForms: {
      update: (id: string, data: UpdateCandidateRegistrationFormRequest) =>
        fetcher<CandidateRegistrationForm>(`/registration-forms/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        }),
      delete: (id: string) => fetcher<void>(`/registration-forms/${id}`, { method: 'DELETE' }),

      // Candidate-facing
      list: () => fetcher<CandidateRegistrationFormSummary[]>(`/registration-forms`),
      get: (id: string) => fetcher<CandidateRegistrationFormDetail>(`/registration-forms/${id}`),
      saveDraft: (formId: string, data: UpsertCandidateRegistrationDraftRequest) =>
        fetcher<CandidateRegistration>(`/registration-forms/${formId}/registrations`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),

      // Reviewer-facing list of submissions for a form
      submissions: (formId: string) =>
        fetcher<CandidateRegistration[]>(`/registration-forms/${formId}/registrations`),
    },

    registrations: {
      submit: (id: string) =>
        fetcher<CandidateRegistration>(`/registrations/${id}/submit`, { method: 'POST' }),
      withdraw: (id: string) =>
        fetcher<CandidateRegistration>(`/registrations/${id}/withdraw`, { method: 'POST' }),
      approve: (id: string) =>
        fetcher<CandidateRegistration>(`/registrations/${id}/approve`, { method: 'POST' }),
      reject: (id: string, reason: string) =>
        fetcher<CandidateRegistration>(`/registrations/${id}/reject`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        }),

      // Team invites
      team: (id: string) =>
        fetcher<{ teamSize: number; slots: TeamSlot[] }>(`/registrations/${id}/team`),
      regenerateTeamSlot: (id: string, slot: number) =>
        fetcher<RegenerateTeamInviteResponse>(`/registrations/${id}/team/${slot}`, {
          method: 'POST',
        }),
      decideTeamSlot: (id: string, slot: number, decision: 'CONFIRMED' | 'DECLINED') =>
        fetcher<{
          slot: number;
          decision: 'CONFIRMED' | 'DECLINED';
          registrationStatus: 'AWAITING_TEAM' | 'PENDING_REVIEW';
        }>(`/registrations/${id}/team/${slot}/decision`, {
          method: 'PATCH',
          body: JSON.stringify({ decision }),
        }),
    },

    files: {
      upload: (file: File) => {
        const form = new FormData();
        form.append('file', file);
        return fetcher<FileSummary>('/files', { method: 'POST', body: form });
      },
      get: (id: string) => fetcher<FileSummary>(`/files/${id}`),
      delete: (id: string) => fetcher<void>(`/files/${id}`, { method: 'DELETE' }),
    },

    teamInvites: {
      get: (token: string) => fetcher<TeamInvitePreview>(`/team-invites/${token}`),
      accept: (token: string) =>
        fetcher<{ accepted: true; registrationStatus: 'AWAITING_TEAM' | 'PENDING_REVIEW' }>(
          `/team-invites/${token}/accept`,
          { method: 'POST' },
        ),
      reject: (token: string) =>
        fetcher<{ rejected: true }>(`/team-invites/${token}/reject`, { method: 'POST' }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
