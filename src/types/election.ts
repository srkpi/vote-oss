export type ElectionStatus = 'upcoming' | 'open' | 'closed';
export type RestrictionType = 'FACULTY' | 'GROUP' | 'SPECIALITY' | 'STUDY_YEAR' | 'STUDY_FORM';

export interface ElectionRestriction {
  type: RestrictionType;
  value: string;
}

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
  restrictions: ElectionRestriction[];
  minChoices: number;
  maxChoices: number;
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

export type CachedElection = Omit<Election, 'status'> & {
  privateKey: string;
};

export interface ElectionFilters {
  status?: ElectionStatus | 'all';
  search?: string;
  faculty?: string;
}

export interface CreateElectionRestriction {
  type: RestrictionType;
  value: string;
}

export interface CreateElectionRequest {
  title: string;
  opensAt: string;
  closesAt: string;
  choices: string[];
  minChoices?: number;
  maxChoices?: number;
  restrictions?: CreateElectionRestriction[];
}

export interface CreateElectionResponse {
  id: string;
  title: string;
  opensAt: string;
  closesAt: string;
  minChoices: number;
  maxChoices: number;
  publicKey: string;
  choices: ElectionChoice[];
  restrictions: ElectionRestriction[];
}
