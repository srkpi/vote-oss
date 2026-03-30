import type { Admin, InviteToken, InviteTokenRequest, InviteTokenResponse } from '@/types/admin';
import type { ApiResult } from '@/types/api';
import type { DiiaInitResponse } from '@/types/auth';
import type { BallotsResponse } from '@/types/ballot';
import type {
  CreateElectionRequest,
  CreateElectionResponse,
  Election,
  ElectionDetail,
} from '@/types/election';
import type {
  FaqCategoryCreated,
  FaqCategoryData,
  FaqCategoryUpdated,
  FaqItemCreated,
  FaqItemUpdated,
} from '@/types/faq';
import type { VoteToken } from '@/types/vote';

type Fetcher = <T>(path: string, options?: RequestInit) => Promise<ApiResult<T>>;

export function createApiClient(fetcher: Fetcher) {
  return {
    auth: {
      loginWithTicket: (ticketId: string) =>
        fetcher<void>('/auth/kpi-id', { method: 'POST', body: JSON.stringify({ ticketId }) }),
      diiaInit: () => fetcher<DiiaInitResponse>('/auth/diia/init', { method: 'POST' }),
      diiaCheck: (requestId: string) =>
        fetcher<{ status: 'success' | 'processing' }>('/auth/diia/check', {
          method: 'POST',
          body: JSON.stringify({ requestId }),
        }),
      refresh: () => fetcher<void>('/auth/refresh', { method: 'POST' }),
      logout: () => fetcher<void>('/auth/logout', { method: 'POST' }),
    },

    elections: {
      list: () => fetcher<Election[]>('/elections'),
      get: (id: string) => fetcher<ElectionDetail>(`/elections/${id}`),
      create: (data: CreateElectionRequest) =>
        fetcher<CreateElectionResponse>('/elections', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      delete: (id: string) => fetcher<void>(`/elections/${id}`, { method: 'DELETE' }),

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
    },

    admins: {
      list: () => fetcher<Admin[]>('/admins'),
      delete: (userId: string) =>
        fetcher<void>(`/admins/${userId}`, {
          method: 'DELETE',
        }),
      patch: (userId: string, data: { manageAdmins?: boolean; restrictedToFaculty?: boolean }) =>
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
          fetcher<void>(`/admins/invite/${tokenHash}`, {
            method: 'DELETE',
          }),
      },
      join: (token: string) =>
        fetcher<void>('/admins/join', { method: 'POST', body: JSON.stringify({ token }) }),
    },

    campus: {
      getGroups: () => fetcher<Record<string, string[]>>('/campus/groups'),
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
        delete: (id: string) =>
          fetcher<void>(`/faq/categories/${id}`, {
            method: 'DELETE',
          }),
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
        delete: (id: string) =>
          fetcher<void>(`/faq/items/${id}`, {
            method: 'DELETE',
          }),
        reorder: (categoryId: string, order: string[]) =>
          fetcher<void>(`/faq/categories/${categoryId}/items/reorder`, {
            method: 'PATCH',
            body: JSON.stringify({ order }),
          }),
      },
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
