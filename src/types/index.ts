// ==================== AUTH TYPES ====================

export interface User {
  userId: string;
  fullName: string;
  faculty: string;
  group: string;
  isAdmin: boolean;
  restricted_to_faculty: boolean;
  manage_admins: boolean;
}

// ==================== ELECTION TYPES ====================

export type ElectionStatus = 'upcoming' | 'open' | 'closed';

export interface ElectionChoice {
  id: number;
  choice: string;
  position: number;
}

export interface ElectionCreator {
  full_name: string;
  faculty: string;
}

export interface Election {
  id: number;
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

// ==================== BALLOT TYPES ====================

export interface Ballot {
  id: number;
  encrypted_ballot: string;
  created_at: string;
  signature: string;
  previous_hash: string | null;
  current_hash: string;
}

export interface BallotsResponse {
  election: { id: number; title: string };
  ballots: Ballot[];
  total: number;
}

export interface DecryptionResult {
  choiceId: number | null;
  choiceLabel: string | null;
  valid: boolean;
  hashValid: boolean;
}

export type DecryptedMap = Map<number, DecryptionResult>;

// ==================== TALLY TYPES ====================

export interface TallyResult {
  choiceId: number;
  choice: string;
  position: number;
  votes: number;
}

export interface TallyResponse {
  electionId: number;
  title: string;
  closedAt: string;
  privateKey: string;
  results: TallyResult[];
  totalBallots: number;
}

// ==================== VOTE TYPES ====================

export interface VoteToken {
  token: string;
  signature: string;
}

export interface BallotSubmission {
  token: string;
  signature: string;
  encryptedBallot: string;
  nullifier: string;
}

export interface BallotResponse {
  ok: boolean;
  ballotHash: string;
}

// ==================== ADMIN TYPES ====================

export interface Admin {
  user_id: string;
  full_name: string;
  group: string;
  faculty: string;
  promoted_by: string | null;
  promoted_at: string;
  manage_admins: boolean;
  restricted_to_faculty: boolean;
}

export interface InviteTokenRequest {
  validDue: string;
  maxUsage?: number;
  manageAdmins?: boolean;
  restrictedToFaculty?: boolean;
}

export interface InviteTokenResponse {
  token: string;
  maxUsage: number;
  manageAdmins: boolean;
  restrictedToFaculty: boolean;
  validDue: string;
}

// ==================== CREATE ELECTION TYPES ====================

export interface CreateElectionRequest {
  title: string;
  opensAt: string;
  closesAt: string;
  choices: string[];
  restrictedToFaculty?: string | null;
  restrictedToGroup?: string | null;
}

export interface CreateElectionResponse {
  id: number;
  title: string;
  opensAt: string;
  closesAt: string;
  publicKey: string;
  choices: ElectionChoice[];
}

// ==================== API RESPONSE TYPES ====================

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; statusCode: number };

// ==================== UI STATE TYPES ====================

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration?: number;
}

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

// ==================== FILTER TYPES ====================

export interface ElectionFilters {
  status?: ElectionStatus | 'all';
  search?: string;
  faculty?: string;
}
