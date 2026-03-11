export type ElectionStatus = 'upcoming' | 'open' | 'closed';

export interface ElectionChoice {
  id: string;
  choice: string;
  position: number;
}

export interface ElectionCreator {
  full_name: string;
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
}

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
