import { Admin, Election } from '@prisma/client';

import { clearAllVotes } from '@/lib/vote-storage';
import { InviteToken, InviteTokenRequest, InviteTokenResponse } from '@/types/admin';
import { ApiError, ApiResult } from '@/types/api';
import { BallotResponse, BallotsResponse } from '@/types/ballot';
import { CreateElectionRequest, CreateElectionResponse, ElectionDetail } from '@/types/election';
import { TallyResponse } from '@/types/tally';
import { VoteToken } from '@/types/vote';

const BASE_URL = '/api';

// Ensures concurrent 401 responses only trigger a single refresh request
// instead of a stampede of parallel refresh calls.
let _refreshing: Promise<boolean> | null = null;

async function _doRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.ok;
  } catch {
    return false;
  }
}

function triggerRefresh(): Promise<boolean> {
  if (!_refreshing) {
    _refreshing = _doRefresh().finally(() => {
      _refreshing = null;
    });
  }
  return _refreshing;
}

async function rawFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });

    if (!response.ok) {
      let errorMessage = `Сталася помилка (${response.status})`;
      try {
        const errorBody = (await response.json()) as ApiError;
        errorMessage = errorBody.message || errorMessage;
      } catch {
        // ignore
      }
      return { success: false, error: errorMessage, statusCode: response.status };
    }

    const data = (await response.json()) as T;
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Помилка мережі',
      statusCode: 0,
    };
  }
}

/**
 * Fetch with automatic token refresh.
 * On a 401, attempts one silent refresh then retries.
 * If the refresh also fails the user is redirected to /auth/login.
 */
async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const result = await rawFetch<T>(path, options);

  if (result.success || result.statusCode !== 401) {
    return result;
  }

  if (path === '/auth/refresh') {
    return result;
  }

  const refreshed = await triggerRefresh();

  if (refreshed) {
    return rawFetch<T>(path, options);
  }

  if (typeof window !== 'undefined') {
    window.location.href = '/auth/login';
  }

  return {
    success: false,
    error: 'Сесія закінчилась. Будь ласка, увійдіть знову.',
    statusCode: 401,
  };
}

// ==================== AUTH ====================

export async function loginWithTicket(ticketId: string) {
  // Clear any stale vote data from a previous session before logging in.
  if (typeof window !== 'undefined') clearAllVotes();

  return fetchApi<{
    userId: string;
    fullName: string;
    faculty: string;
    group: string;
    isAdmin: boolean;
  }>('/auth/kpi-id', {
    method: 'POST',
    body: JSON.stringify({ ticketId }),
  });
}

export async function logout() {
  const result = await fetchApi<{ ok: boolean }>('/auth/logout', { method: 'POST' });
  // Wipe locally-stored votes so the next user on this device starts clean.
  if (typeof window !== 'undefined') clearAllVotes();
  return result;
}

export async function refreshToken() {
  return rawFetch<{ ok: boolean; isAdmin: boolean }>('/auth/refresh', { method: 'POST' });
}

// ==================== ELECTIONS ====================

export async function getElections() {
  return fetchApi<Election[]>('/elections');
}

export async function getElection(id: string) {
  return fetchApi<ElectionDetail>(`/elections/${id}`);
}

export async function createElection(data: CreateElectionRequest) {
  return fetchApi<CreateElectionResponse>('/elections', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteElection(id: string) {
  return fetchApi<{ ok: boolean; deletedId: string }>(`/elections/${id}`, {
    method: 'DELETE',
  });
}

// ==================== VOTING ====================

export async function getVoteToken(electionId: string) {
  return fetchApi<VoteToken>(`/elections/${electionId}/token`, {
    method: 'POST',
  });
}

export async function submitBallot(
  electionId: string,
  data: {
    token: string;
    signature: string;
    encryptedBallot: string;
    nullifier: string;
  },
) {
  return fetchApi<BallotResponse>(`/elections/${electionId}/ballot`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ==================== BALLOTS ====================

export async function getBallots(electionId: string, page: number = 1, pageSize: number = 50) {
  return fetchApi<BallotsResponse>(
    `/elections/${electionId}/ballots?page=${page}&pageSize=${pageSize}`,
  );
}

// ==================== TALLY ====================

export async function getTally(electionId: string) {
  return fetchApi<TallyResponse>(`/elections/${electionId}/tally`);
}

// ==================== ADMINS ====================

export async function getAdmins() {
  return fetchApi<Admin[]>('/admins');
}

export async function deleteAdmin(userId: string) {
  return fetchApi<{ ok: boolean; removedUserId: string }>(`/admins/${userId}`, {
    method: 'DELETE',
  });
}

// ==================== INVITE TOKENS ====================

export async function getInviteTokens() {
  return fetchApi<InviteToken[]>('/admins/invite');
}

export async function createInviteToken(data: InviteTokenRequest) {
  return fetchApi<InviteTokenResponse>('/admins/invite', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteInviteToken(tokenHash: string) {
  return fetchApi<{ ok: boolean; deletedTokenHash: string }>(`/admins/invite/${tokenHash}`, {
    method: 'DELETE',
  });
}

// ==================== JOIN ====================

export async function joinAsAdmin(token: string) {
  return fetchApi<{
    userId: string;
    fullName: string;
    faculty: string;
    group: string;
    manageAdmins: boolean;
    restrictedToFaculty: boolean;
    promotedBy: string;
  }>('/admins/join', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}
