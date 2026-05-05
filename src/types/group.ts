import type { Election } from './election';
import type { FileSummary } from './file';

export type GroupType = 'VKSU' | 'OTHER';

export const GROUP_TYPE_LABELS: Record<GroupType, string> = {
  VKSU: 'ВКСУ',
  OTHER: 'Інша',
};

export interface GroupMemberSummary {
  userId: string;
  displayName: string;
  role: string | null;
  joinedAt: string;
  isOwner: boolean;
}

export interface GroupInviteLinkUsageSummary {
  id: string;
  userId: string;
  usedAt: string;
}

export interface GroupInviteLink {
  id: string;
  groupId: string;
  label: string | null;
  maxUsage: number;
  currentUsage: number;
  expiresAt: string;
  createdBy: string;
  createdAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
  usages: GroupInviteLinkUsageSummary[];
  canRevoke: boolean;
}

export interface GroupRequisites {
  fullName: string | null;
  address: string | null;
  email: string | null;
  contact: string | null;
  logo: FileSummary | null;
}

export interface UpdateGroupRequisitesPatch {
  fullName?: string | null;
  address?: string | null;
  email?: string | null;
  contact?: string | null;
}

export interface Group {
  id: string;
  name: string;
  type: GroupType;
  ownerId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  isOwner: boolean;
  isMember: boolean;
  deletedAt: string | null;
  requisites: GroupRequisites;
}

export interface GroupDetail extends Group {
  members: GroupMemberSummary[];
  inviteLinks: GroupInviteLink[];
  /**
   * Elections that restrict eligibility to this group's membership
   * (ElectionRestriction.type = GROUP_MEMBERSHIP).
   *
   * For members (and admins with manage_groups) this includes every
   * non-deleted election targeting the group.  For non-member viewers
   * (allowed through because at least one such election is public), this
   * contains only the public ones.
   */
  elections: Election[];
}

// For election restriction display / selection
export interface GroupOption {
  id: string;
  name: string;
  memberCount: number;
}

// Request / response shapes
export interface UpdateGroupRequest {
  name?: string;
  type?: GroupType;
  requisites?: UpdateGroupRequisitesPatch;
}

export interface CreateInviteLinkRequest {
  label?: string;
  maxUsage: number;
  expiresAt: string;
}

export interface JoinGroupResponse {
  groupId: string;
  groupName: string;
}

export interface AdminGroupSummary {
  id: string;
  name: string;
  type: GroupType;
  ownerId: string;
  ownerName: string | null;
  memberCount: number;
  createdAt: string;
  deletedAt: string | null;
}
