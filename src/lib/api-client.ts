import type {
  Election,
  ElectionDetail,
  BallotsResponse,
  TallyResponse,
  VoteToken,
  BallotResponse,
  Admin,
  InviteTokenRequest,
  InviteTokenResponse,
  CreateElectionRequest,
  CreateElectionResponse,
  ApiResult,
  ApiError,
} from '@/types';

const BASE_URL = '/api';

async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
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

// ==================== AUTH ====================

export async function loginWithTicket(ticketId: string) {
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
  return fetchApi<{ ok: boolean }>('/auth/logout', { method: 'POST' });
}

export async function refreshToken() {
  return fetchApi<{ ok: boolean }>('/auth/refresh', { method: 'POST' });
}

// ==================== ELECTIONS ====================

export async function getElections() {
  return fetchApi<Election[]>('/elections');
}

export async function getElection(id: number) {
  return fetchApi<ElectionDetail>(`/elections/${id}`);
}

export async function createElection(data: CreateElectionRequest) {
  return fetchApi<CreateElectionResponse>('/elections', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ==================== VOTING ====================

export async function getVoteToken(electionId: number) {
  return fetchApi<VoteToken>(`/elections/${electionId}/token`, {
    method: 'POST',
  });
}

export async function submitBallot(
  electionId: number,
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

export async function getBallots(electionId: number, page: number = 1, pageSize: number = 50) {
  return fetchApi<BallotsResponse>(
    `/elections/${electionId}/ballots?page=${page}&pageSize=${pageSize}`,
  );
}

// ==================== TALLY ====================

export async function getTally(electionId: number) {
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

export async function createInviteToken(data: InviteTokenRequest) {
  return fetchApi<InviteTokenResponse>('/admins/invite', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

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
