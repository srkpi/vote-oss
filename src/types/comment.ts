export interface CommentAuthor {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  deletedBy: CommentAuthor | null;
  author: CommentAuthor;
  isPetitionAuthor: boolean;
  isAdmin: boolean;
  canEdit: boolean;
  canDelete: boolean;
  upCount: number;
  downCount: number;
  myVote: 'UP' | 'DOWN' | null;
}

export interface CommentsListResponse {
  comments: Comment[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CommentVoter {
  userId: string;
  fullName: string;
  value: 'UP' | 'DOWN';
  avatarUrl: string | null;
  votedAt: string;
}

export interface CommentVotersResponse {
  voters: CommentVoter[];
  nextCursor: string | null;
  hasMore: boolean;
  upCount: number;
  downCount: number;
}

export interface CommentVoteSummary {
  upCount: number;
  downCount: number;
  myVote: 'UP' | 'DOWN' | null;
}

export interface DiscussionStatus {
  commentsClosed: boolean;
  commentsClosedAt: string | null;
}

export interface PetitionOfficialAnswer {
  body: string;
  createdAt: string;
  author: CommentAuthor;
  editedAt: string | null;
  editedBy: CommentAuthor | null;
  canManage: boolean;
}
