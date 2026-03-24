export type ElectionStatus = 'upcoming' | 'open' | 'closed';

export interface ElectionChoice {
  id: string;
  choice: string;
  position: number;
}

export interface ElectionCreator {
  fullName: string;
  faculty: string;
}

export interface Election {
  id: string;
  title: string;
  createdAt: string;
  opensAt: string;
  closesAt: string;
  status: ElectionStatus;
  restrictedToFaculty: string | null;
  restrictedToGroup: string | null;
  publicKey: string;
  privateKey?: string;
  creator: ElectionCreator;
  choices: ElectionChoice[];
  ballotCount: number;
}

export interface ElectionDetail extends Election {
  privateKey?: string;
  hasVoted?: boolean;
}

/**
 * Shape stored in Redis for each election.
 *
 * `status` is intentionally absent – it is derived from `opensAt`/`closesAt`
 * at serve time so cached entries never return a stale status.
 *
 * `privateKey` is always stored so we can expose it once the election closes
 * without a cache miss, but route handlers must strip it for open elections.
 */
export type CachedElection = Omit<Election, 'status'> & {
  privateKey: string; // always present in cache; conditionally exposed to clients
};

export interface ElectionFilters {
  status?: ElectionStatus | 'all';
  search?: string;
  faculty?: string;
}

export interface CreateElectionRequest {
  title: string;
  opensAt: string;
  closesAt: string;
  choices: string[];
  restrictedToFaculty?: string | null;
  restrictedToGroup?: string | null;
}

export interface CreateElectionResponse {
  id: string;
  title: string;
  opensAt: string;
  closesAt: string;
  publicKey: string;
  choices: ElectionChoice[];
}
