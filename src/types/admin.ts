export interface Admin {
  user_id: string;
  full_name: string;
  group: string;
  faculty: string;
  promoted_by: string | null;
  promoted_at: string;
  manage_admins: boolean;
  restricted_to_faculty: boolean;
  deletable?: boolean;
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
