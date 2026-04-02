export type BypassTokenType = 'GLOBAL' | 'ELECTION';

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

export interface BypassToken {
  tokenHash: string;
  type: BypassTokenType;
  electionId: string | null;
  bypassNotStudying: boolean;
  bypassGraduate: boolean;
  bypassRestrictions: string[];
  maxUsage: number | null;
  currentUsage: number;
  validUntil: string;
  createdAt: string;
  creator: { userId: string; fullName: string };
  usages: BypassTokenUsage[];
}

export interface BypassTokenUsage {
  id: string;
  userId: string;
  usedAt: string;
  revokedAt: string | null;
}

export interface CreateBypassTokenRequest {
  type: BypassTokenType;
  electionId?: string;
  bypassNotStudying?: boolean;
  bypassGraduate?: boolean;
  bypassRestrictions?: string[];
  maxUsage?: number | null;
  validUntil: string;
}
