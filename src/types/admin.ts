export interface AdminPromoter {
  userId: string;
  fullName: string;
}

export interface Admin {
  userId: string;
  fullName: string;
  group: string;
  faculty: string;
  promoter: AdminPromoter | null;
  promotedAt: string;
  manageAdmins: boolean;
  restrictedToFaculty: boolean;
  deletable?: boolean;
}

export type CachedAdmin = Admin;

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

export interface InviteToken {
  tokenHash: string;
  maxUsage: number;
  currentUsage: number;
  manageAdmins: boolean;
  restrictedToFaculty: boolean;
  validDue: string;
  createdAt: string;
  creator: { userId: string; fullName: string };
  isOwn: boolean;
  deletable: boolean;
}

/**
 * Shape stored in Redis — same as InviteToken but without the
 * caller-specific computed flags (isOwn / deletable).
 * Those are added at serve time after hierarchy resolution.
 */
export type CachedInviteToken = Omit<InviteToken, 'isOwn' | 'deletable'>;
