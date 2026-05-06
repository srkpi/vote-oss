import type { CampaignState, ElectionKind, RestrictionType } from '@prisma/client';

export type { CampaignState, ElectionKind };

export interface ElectionCampaignRestriction {
  type: RestrictionType;
  value: string;
}

export interface ElectionCampaign {
  id: string;
  groupId: string;
  groupName: string;

  positionTitle: string;
  electionKind: ElectionKind;
  state: CampaignState;

  announcedAt: string;
  registrationDays: number;
  registrationReviewDays: number;
  registrationOpensTime: string;
  registrationClosesTime: string;

  signatureCollection: boolean;
  signatureDays: number | null;
  signatureReviewDays: number | null;
  signatureQuorum: number | null;
  signaturesOpensTime: string | null;
  signaturesClosesTime: string | null;

  teamSize: number;
  requiresCampaignProgram: boolean;

  votingOpensAt: string;
  votingClosesAt: string;

  restrictions: ElectionCampaignRestriction[];

  registrationFormId: string | null;
  finalElectionId: string | null;

  createdBy: string;
  createdByFullName: string;
  createdAt: string;

  deletedAt: string | null;
}

export interface CampaignSignatureElectionSummary {
  electionId: string;
  registrationId: string;
  candidateUserId: string;
  candidateFullName: string;
  opensAt: string;
  closesAt: string;
  ballotCount: number;
  quorum: number;
  quorumReached: boolean;
  status: 'upcoming' | 'open' | 'closed';
}

export interface CampaignFinalElectionChoice {
  candidateRegistrationId: string | null;
  candidateFullName: string;
  position: number;
  voteCount: number | null;
}

export interface CampaignFinalElectionSummary {
  electionId: string;
  status: 'upcoming' | 'open' | 'closed';
  opensAt: string;
  closesAt: string;
  ballotCount: number;
  choices: CampaignFinalElectionChoice[];
}

export interface CreateElectionCampaignRequest {
  positionTitle: string;
  electionKind: ElectionKind;
  announcedAt: string;
  registrationDays: number;
  registrationReviewDays: number;
  registrationOpensTime: string;
  registrationClosesTime: string;
  signatureCollection: boolean;
  signatureDays?: number | null;
  signatureReviewDays?: number | null;
  signatureQuorum?: number | null;
  signaturesOpensTime?: string | null;
  signaturesClosesTime?: string | null;
  teamSize?: number;
  requiresCampaignProgram?: boolean;
  votingOpensAt: string;
  votingClosesAt: string;
  restrictions?: ElectionCampaignRestriction[];
}
