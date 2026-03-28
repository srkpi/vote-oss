import type { Admin, InviteToken, InviteTokenRequest, InviteTokenResponse } from '@/types/admin';
import type { ApiResult } from '@/types/api';
import type { UserInfo } from '@/types/auth';
import type { BallotResponse, BallotsResponse } from '@/types/ballot';
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
import type { TallyResponse } from '@/types/tally';
import type { VoteToken } from '@/types/vote';

type Fetcher = <T>(path: string, options?: RequestInit) => Promise<ApiResult<T>>;

export function createApiClient(fetcher: Fetcher) {
  return {
    auth: {
      loginWithTicket: (ticketId: string) =>
        fetcher<UserInfo>('/auth/kpi-id', { method: 'POST', body: JSON.stringify({ ticketId }) }),
      refresh: () =>
        fetcher<{ ok: boolean; isAdmin: boolean }>('/auth/refresh', { method: 'POST' }),
      logout: () => fetcher<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
    },

    elections: {
      list: () => fetcher<Election[]>('/elections'),
      get: (id: string) => fetcher<ElectionDetail>(`/elections/${id}`),
      create: (data: CreateElectionRequest) =>
        fetcher<CreateElectionResponse>('/elections', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      delete: (id: string) =>
        fetcher<{ ok: boolean; deletedId: string }>(`/elections/${id}`, { method: 'DELETE' }),

      getVoteToken: (electionId: string) =>
        fetcher<VoteToken>(`/elections/${electionId}/token`, { method: 'POST' }),
      submitBallot: (
        electionId: string,
        data: { token: string; signature: string; encryptedBallot: string; nullifier: string },
      ) =>
        fetcher<BallotResponse>(`/elections/${electionId}/ballot`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),

      getBallots: (electionId: string) =>
        fetcher<BallotsResponse>(`/elections/${electionId}/ballots`),
      getTally: (electionId: string) => fetcher<TallyResponse>(`/elections/${electionId}/tally`),
    },

    admins: {
      list: () => fetcher<Admin[]>('/admins'),
      delete: (userId: string) =>
        fetcher<{ ok: boolean; removedUserId: string }>(`/admins/${userId}`, {
          method: 'DELETE',
        }),
      invites: {
        list: () => fetcher<InviteToken[]>('/admins/invite'),
        create: (data: InviteTokenRequest) =>
          fetcher<InviteTokenResponse>('/admins/invite', {
            method: 'POST',
            body: JSON.stringify(data),
          }),
        delete: (tokenHash: string) =>
          fetcher<{ ok: boolean; deletedTokenHash: string }>(`/admins/invite/${tokenHash}`, {
            method: 'DELETE',
          }),
      },
      join: (token: string) =>
        fetcher<{
          manageAdmins: boolean;
          restrictedToFaculty: boolean;
        }>('/admins/join', { method: 'POST', body: JSON.stringify({ token }) }),
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
          fetcher<{ ok: boolean; deletedId: string }>(`/faq/categories/${id}`, {
            method: 'DELETE',
          }),
        reorder: (order: string[]) =>
          fetcher<{ ok: boolean }>('/faq/categories/reorder', {
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
          fetcher<{ ok: boolean; deletedId: string }>(`/faq/items/${id}`, {
            method: 'DELETE',
          }),
        reorder: (categoryId: string, order: string[]) =>
          fetcher<{ ok: boolean }>(`/faq/categories/${categoryId}/items/reorder`, {
            method: 'PATCH',
            body: JSON.stringify({ order }),
          }),
      },
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
