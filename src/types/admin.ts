export interface AdminPromoter {
  user_id: string;
  full_name: string;
}

export interface Admin {
  user_id: string;
  full_name: string;
  group: string;
  faculty: string;
  promoter: AdminPromoter | null;
  promoted_at: string;
  manage_admins: boolean;
  restricted_to_faculty: boolean;
  deletable?: boolean;
}

export type CachedAdmin = Omit<Admin, 'promoted_at'> & { promoted_at: Date };

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
  token_hash: string;
  max_usage: number;
  current_usage: number;
  manage_admins: boolean;
  restricted_to_faculty: boolean;
  valid_due: string;
  created_at: string;
  creator: { user_id: string; full_name: string };
  isOwn: boolean;
  deletable: boolean;
}

/**
 * Shape stored in Redis — same as InviteToken but without the
 * caller-specific computed flags (isOwn / deletable).
 * Those are added at serve time after hierarchy resolution.
 */
export type CachedInviteToken = Omit<InviteToken, 'isOwn' | 'deletable'>;
