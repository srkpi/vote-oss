import type { FaqCategoryData } from '@/components/faq/faq-accordion';
import type { Admin, InviteToken, InviteTokenRequest, InviteTokenResponse } from '@/types/admin';
import type { ApiResult } from '@/types/api';
import type { BallotResponse, BallotsResponse } from '@/types/ballot';
import type {
  CreateElectionRequest,
  CreateElectionResponse,
  Election,
  ElectionDetail,
} from '@/types/election';
import type { TallyResponse } from '@/types/tally';
import type { VoteToken } from '@/types/vote';

type Fetcher = <T>(path: string, options?: RequestInit) => Promise<ApiResult<T>>;

export function createApiClient(fetcher: Fetcher) {
  return {
    loginWithTicket: (ticketId: string) =>
      fetcher<{
        userId: string;
        fullName: string;
        faculty: string;
        group: string;
        isAdmin: boolean;
      }>('/auth/kpi-id', { method: 'POST', body: JSON.stringify({ ticketId }) }),
    refreshToken: () =>
      fetcher<{ ok: boolean; isAdmin: boolean }>('/auth/refresh', { method: 'POST' }),
    logout: () => fetcher<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

    getElections: () => fetcher<Election[]>('/elections'),
    getElection: (id: string) => fetcher<ElectionDetail>(`/elections/${id}`),
    createElection: (data: CreateElectionRequest) =>
      fetcher<CreateElectionResponse>('/elections', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deleteElection: (id: string) =>
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

    getAdmins: () => fetcher<Admin[]>('/admins'),
    deleteAdmin: (userId: string) =>
      fetcher<{ ok: boolean; removedUserId: string }>(`/admins/${userId}`, {
        method: 'DELETE',
      }),

    getInviteTokens: () => fetcher<InviteToken[]>('/admins/invite'),
    createInviteToken: (data: InviteTokenRequest) =>
      fetcher<InviteTokenResponse>('/admins/invite', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deleteInviteToken: (tokenHash: string) =>
      fetcher<{ ok: boolean; deletedTokenHash: string }>(`/admins/invite/${tokenHash}`, {
        method: 'DELETE',
      }),

    joinAsAdmin: (token: string) =>
      fetcher<{
        userId: string;
        fullName: string;
        faculty: string;
        group: string;
        manageAdmins: boolean;
        restrictedToFaculty: boolean;
        promotedBy: string;
      }>('/admins/join', { method: 'POST', body: JSON.stringify({ token }) }),

    // FAQ
    getFaq: () => fetcher<FaqCategoryData[]>('/faq'),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
