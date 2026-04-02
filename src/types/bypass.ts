export interface GlobalBypassInfo {
  bypassNotStudying: boolean;
  bypassGraduate: boolean;
  validUntil: number;
}

export interface ElectionBypassInfo {
  electionId: string;
  bypassedTypes: string[];
  validUntil: number;
}

export interface UserBypassInfo {
  global: GlobalBypassInfo | null;
  elections: Record<string, ElectionBypassInfo>;
}

export interface BypassTokenUsage {
  id: string;
  userId: string;
  usedAt: string;
  revokedAt: string | null;
}

export interface GlobalBypassToken {
  tokenHash: string;
  bypassNotStudying: boolean;
  bypassGraduate: boolean;
  maxUsage: number;
  currentUsage: number;
  validUntil: string;
  createdAt: string;
  creator: { userId: string; fullName: string };
  usages: BypassTokenUsage[];
  canDelete: boolean;
  canRevokeUsages: boolean;
}

export interface ElectionBypassToken {
  tokenHash: string;
  electionId: string;
  bypassRestrictions: string[];
  maxUsage: number;
  currentUsage: number;
  createdAt: string;
  creator: { userId: string; fullName: string };
  usages: BypassTokenUsage[];
  canDelete: boolean;
  canRevokeUsages: boolean;
}

export type BypassToken = GlobalBypassToken | ElectionBypassToken;

export interface CreateGlobalBypassTokenRequest {
  bypassNotStudying?: boolean;
  bypassGraduate?: boolean;
  maxUsage: number;
  validUntil: string;
}

export interface CreateElectionBypassTokenRequest {
  bypassRestrictions: string[];
  maxUsage: number;
}
